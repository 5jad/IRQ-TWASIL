import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import { ensureSeeded } from '../seed.ts';
import {
  commentsTable,
  followsTable,
  postsTable,
  reactionsTable,
  usersTable,
} from '../schema.ts';
import { parseUserSettings, toPublicUser, type PublicUserDto } from '../../server/dto.ts';
import { deleteMediaByIdOrUrl } from '../../server/media.ts';
import { buildCommentTree } from '../../lib/remediation.ts';
import { canViewerSeePost } from '../../lib/visibility.ts';
import { arabicTextMatches } from '../../lib/arabicSearch.ts';
import {
  DomainError,
  claimReadyMediaForUse,
  createAndEmitNotification,
  loadViewerPostReactionSets,
  loadViewerRelationships,
  mapPostRowToDto,
} from './shared.ts';
import type { Post, PostComment } from '../../types/index.ts';

export async function getPaginatedPostsInDb(
  viewerId: string | null,
  options: {
    cursor?: string | null;
    limit?: number;
    tab?: 'all' | 'following' | 'province' | 'merchants' | 'reels';
    authorId?: string;
    q?: string;
  } = {}
): Promise<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }> {
  await ensureSeeded();
  const db = getDb();

  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  const parsedCursor =
    options.cursor !== undefined && options.cursor !== null && options.cursor !== ''
      ? Number(options.cursor)
      : null;
  let cursorTs: number | null =
    parsedCursor !== null && Number.isFinite(parsedCursor) ? parsedCursor : null;

  const rel = await loadViewerRelationships(viewerId);
  const visibilityCtx = {
    viewerId: rel.viewerId,
    followingSet: rel.followingSet,
    closeFriendOfSet: rel.closeFriendOfSet,
    blockedIds: rel.blockedIds,
  };

  let viewerProvince: string | null = null;
  if (viewerId && options.tab === 'province') {
    const [vRow] = await db
      .select({ province: usersTable.province })
      .from(usersTable)
      .where(eq(usersTable.id, viewerId))
      .limit(1);
    viewerProvince = vRow?.province ?? 'بغداد';
  }

  const collectedRows: Array<typeof postsTable.$inferSelect> = [];
  const authorCache = new Map<string, PublicUserDto>();
  let dbExhausted = false;
  const batchSize = Math.min(60, Math.max(25, limit * 3));

  while (collectedRows.length <= limit && !dbExhausted) {
    const conditions = [];
    if (cursorTs !== null) {
      conditions.push(lt(postsTable.sortTs, cursorTs));
    }
    if (options.authorId) {
      conditions.push(eq(postsTable.authorId, options.authorId));
    }
    if (options.tab === 'reels') {
      conditions.push(eq(postsTable.kind, 'reel'));
    }

    const batch = await db
      .select()
      .from(postsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(postsTable.sortTs))
      .limit(batchSize);

    if (batch.length < batchSize) dbExhausted = true;
    if (batch.length === 0) break;

    cursorTs = batch[batch.length - 1]!.sortTs;

    const missingAuthorIds = Array.from(
      new Set(
        batch
          .map((r) => r.authorId)
          .filter((id) => !authorCache.has(id) && !rel.blockedIds.has(id))
      )
    );
    if (missingAuthorIds.length > 0) {
      const authorRows = await db
        .select()
        .from(usersTable)
        .where(and(inArray(usersTable.id, missingAuthorIds), eq(usersTable.status, 'active')));
      for (const u of authorRows) {
        authorCache.set(
          u.id,
          toPublicUser(u, {
            isCloseFriend: rel.closeFriendSet.has(u.id),
            isFollowing: rel.followingSet.has(u.id),
            isFollowedBy: rel.followedBySet.has(u.id),
          })
        );
      }
    }

    for (const row of batch) {
      if (!canViewerSeePost(row.authorId, row.audience, visibilityCtx)) continue;
      const author = authorCache.get(row.authorId);
      if (!author) continue;

      if (options.tab === 'following' && viewerId && !rel.followingSet.has(row.authorId) && row.authorId !== viewerId) {
        continue;
      }
      if (options.tab === 'province' && viewerProvince && author.province !== viewerProvince) {
        continue;
      }
      if (options.tab === 'merchants' && author.accountType !== 'merchant' && author.verifiedKind !== 'merchant') {
        continue;
      }
      if (options.q && options.q.trim()) {
        const hay = `${row.text} ${author.displayName} ${author.username} ${row.location ?? ''}`;
        if (!arabicTextMatches(hay, options.q)) continue;
      }

      const rawMedia = (row.mediaJson as Post['media'] | null) ?? undefined;
      const cleanMedia = rawMedia?.filter((m) => m.url && !m.url.startsWith('blob:'));
      if (!row.text?.trim() && (!cleanMedia || cleanMedia.length === 0) && !row.pollJson) {
        continue;
      }

      collectedRows.push(row);
      if (collectedRows.length > limit) break;
    }
  }

  const hasMore = collectedRows.length > limit;
  const pageRows = collectedRows.slice(0, limit);
  const nextCursor =
    hasMore && pageRows.length > 0 ? String(pageRows[pageRows.length - 1]!.sortTs) : null;

  const reactionSets = await loadViewerPostReactionSets(
    viewerId,
    pageRows.map((r) => r.id)
  );

  const posts: Post[] = [];
  for (const row of pageRows) {
    const author = authorCache.get(row.authorId);
    if (!author) continue;
    const dto = mapPostRowToDto(row, author, {
      viewerId,
      likedSet: reactionSets.likedSet,
      savedSet: reactionSets.savedSet,
      repostedSet: reactionSets.repostedSet,
      pollVotesMap: reactionSets.pollVotesMap,
    });
    if (dto) posts.push(dto);
  }

  return { posts, nextCursor, hasMore };
}

export async function getPostCommentsInDb(
  viewerId: string | null,
  postId: string
): Promise<{ comments: PostComment[]; totalCount: number } | null> {
  await ensureSeeded();
  const db = getDb();

  const [post] = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      audience: postsTable.audience,
      commentsCount: postsTable.commentsCount,
    })
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!post) return null;

  const rel = await loadViewerRelationships(viewerId);
  const visibilityCtx = {
    viewerId: rel.viewerId,
    followingSet: rel.followingSet,
    closeFriendOfSet: rel.closeFriendOfSet,
    blockedIds: rel.blockedIds,
  };

  if (!canViewerSeePost(post.authorId, post.audience, visibilityCtx)) {
    return null;
  }

  const commentRows = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.postId, postId))
    .orderBy(asc(commentsTable.sortTs))
    .limit(300);

  if (commentRows.length === 0) {
    return { comments: [], totalCount: post.commentsCount };
  }

  const authorIds = Array.from(
    new Set(commentRows.map((c) => c.authorId).filter((id) => !rel.blockedIds.has(id)))
  );
  const authorRows =
    authorIds.length > 0
      ? await db
          .select()
          .from(usersTable)
          .where(and(inArray(usersTable.id, authorIds), eq(usersTable.status, 'active')))
      : [];

  const authorMap = new Map<string, PublicUserDto>();
  for (const u of authorRows) {
    authorMap.set(
      u.id,
      toPublicUser(u, {
        isCloseFriend: rel.closeFriendSet.has(u.id),
        isFollowing: rel.followingSet.has(u.id),
        isFollowedBy: rel.followedBySet.has(u.id),
      })
    );
  }

  const commentLikedSet = new Set<string>();
  if (viewerId) {
    const commentIds = commentRows.map((c) => c.id);
    const likedRows = await db
      .select({ targetId: reactionsTable.targetId })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, viewerId),
          eq(reactionsTable.targetType, 'comment_like'),
          inArray(reactionsTable.targetId, commentIds)
        )
      );
    for (const lr of likedRows) {
      commentLikedSet.add(lr.targetId);
    }
  }

  const flatComments: PostComment[] = [];
  for (const row of commentRows) {
    if (rel.blockedIds.has(row.authorId)) continue;
    const author = authorMap.get(row.authorId);
    if (!author) continue;
    flatComments.push({
      id: row.id,
      parentId: row.parentId ?? undefined,
      author,
      text: row.text,
      createdAt: row.createdAt,
      likesCount: row.likesCount,
      isLiked: viewerId ? commentLikedSet.has(row.id) : false,
    });
  }

  return {
    comments: buildCommentTree(flatComments),
    totalCount: Math.max(post.commentsCount, flatComments.length),
  };
}

export async function getPostByIdInDb(
  viewerId: string | null,
  postId: string
): Promise<Post | null> {
  await ensureSeeded();
  const db = getDb();

  const [row] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!row) return null;

  const rel = await loadViewerRelationships(viewerId);
  const visibilityCtx = {
    viewerId: rel.viewerId,
    followingSet: rel.followingSet,
    closeFriendOfSet: rel.closeFriendOfSet,
    blockedIds: rel.blockedIds,
  };

  if (!canViewerSeePost(row.authorId, row.audience, visibilityCtx)) {
    return null;
  }

  const [authorRow] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, row.authorId), eq(usersTable.status, 'active')))
    .limit(1);

  if (!authorRow) return null;

  const author = toPublicUser(authorRow, {
    isCloseFriend: rel.closeFriendSet.has(authorRow.id),
    isFollowing: rel.followingSet.has(authorRow.id),
    isFollowedBy: rel.followedBySet.has(authorRow.id),
  });

  const [reactionSets, commentsRes] = await Promise.all([
    loadViewerPostReactionSets(viewerId, [row.id]),
    getPostCommentsInDb(viewerId, row.id),
  ]);

  return mapPostRowToDto(row, author, {
    viewerId,
    likedSet: reactionSets.likedSet,
    savedSet: reactionSets.savedSet,
    repostedSet: reactionSets.repostedSet,
    pollVotesMap: reactionSets.pollVotesMap,
    comments: commentsRes?.comments ?? [],
  });
}

export async function createPostInDb(
  actorId: string,
  input: {
    id: string;
    text: string;
    mediaId?: string;
    mediaIds?: string[];
    kind?: 'media' | 'text' | 'video' | 'reel';
    audioTrack?: string;
    location?: string;
    audience?: 'everyone' | 'followers' | 'friends';
    aspectRatio?: string;
    createdAt?: string;
  }
) {
  await ensureSeeded();
  const db = getDb();
  const nowTs = Date.now();
  const createdAt = input.createdAt ?? new Date(nowTs).toISOString();

  const mediaIdList =
    input.mediaIds && input.mediaIds.length > 0
      ? input.mediaIds.slice(0, 10)
      : input.mediaId
      ? [input.mediaId]
      : [];

  let mediaJson: Post['media'] | null = null;
  let postKind: Post['kind'] = input.kind === 'reel' ? 'reel' : 'text';

  if (mediaIdList.length > 0) {
    const claimedItems: Array<{ publicUrl: string; thumbUrl: string | null; mime: string }> = [];
    for (const mId of mediaIdList) {
      const claimed = await claimReadyMediaForUse(mId, actorId, 'post', input.id);
      claimedItems.push(claimed);
    }
    const hasVideo = claimedItems.some((item) => item.mime.startsWith('video/'));
    postKind = input.kind === 'reel' ? 'reel' : hasVideo && claimedItems.length === 1 ? 'video' : 'media';
    mediaJson = claimedItems.map((claimed) => ({
      url: claimed.publicUrl,
      aspectRatio: input.aspectRatio ?? (postKind === 'reel' ? '9/16' : '4/5'),
      alt: input.text.slice(0, 80) || (postKind === 'reel' ? 'ريلز جديد' : 'منشور جديد'),
    }));
  }

  await db.transaction(async (tx) => {
    await tx.insert(postsTable).values({
      id: input.id,
      authorId: actorId,
      kind: postKind,
      text: input.text,
      mediaId: mediaIdList[0] ?? null,
      mediaJson,
      pollJson: null,
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      isLiked: false,
      isSaved: false,
      taggedProductsJson: null,
      location: input.location ?? null,
      audioTrack: input.audioTrack ?? null,
      audience: input.audience ?? 'everyone',
      createdAt,
      sortTs: nowTs,
    });

    await tx
      .update(usersTable)
      .set({ postsCount: sql`${usersTable.postsCount} + 1` })
      .where(eq(usersTable.id, actorId));
  });

  return {
    id: input.id,
    createdAt,
    media: mediaJson ?? undefined,
    kind: postKind,
    audioTrack: input.audioTrack ?? undefined,
    location: input.location ?? undefined,
    audience: input.audience ?? 'everyone',
  };
}

export async function deletePostInDb(actorId: string, postId: string, actorRole?: string) {
  const db = getDb();
  const [post] = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      mediaId: postsTable.mediaId,
      mediaJson: postsTable.mediaJson,
    })
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!post) return null;
  if (post.authorId !== actorId && actorRole !== 'admin' && actorRole !== 'moderator') {
    throw new DomainError(403, 'forbidden', 'لا يمكنك حذف منشور لا تملكه');
  }

  await db.transaction(async (tx) => {
    await tx.delete(postsTable).where(eq(postsTable.id, postId));
    await tx
      .update(usersTable)
      .set({ postsCount: sql`GREATEST(0, ${usersTable.postsCount} - 1)` })
      .where(eq(usersTable.id, post.authorId));
  });

  if (post.mediaId) {
    await deleteMediaByIdOrUrl(post.mediaId, null).catch(() => undefined);
  }
  const mediaList = (post.mediaJson as Post['media'] | null) ?? [];
  for (const item of mediaList) {
    if (item?.url) {
      await deleteMediaByIdOrUrl(null, item.url).catch(() => undefined);
    }
  }

  return { deleted: true };
}

export async function toggleLikePostInDb(actorId: string, postId: string) {
  await ensureSeeded();
  const db = getDb();
  const outcome = await db.transaction(async (tx) => {
    const [post] = await tx
      .select({
        id: postsTable.id,
        authorId: postsTable.authorId,
        text: postsTable.text,
        mediaJson: postsTable.mediaJson,
        likesCount: postsTable.likesCount,
      })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return null;

    const [existing] = await tx
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'post_like'),
          eq(reactionsTable.targetId, postId)
        )
      )
      .limit(1);

    const nextLiked = !existing;
    if (nextLiked) {
      await tx.insert(reactionsTable).values({
        userId: actorId,
        targetType: 'post_like',
        targetId: postId,
        value: '1',
      });
    } else {
      await tx
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.userId, actorId),
            eq(reactionsTable.targetType, 'post_like'),
            eq(reactionsTable.targetId, postId)
          )
        );
    }

    const nextLikesCount = nextLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1);
    await tx
      .update(postsTable)
      .set({ likesCount: nextLikesCount })
      .where(eq(postsTable.id, postId));

    const firstMedia = (post.mediaJson as Post['media'] | null)?.[0]?.url;
    return {
      isLiked: nextLiked,
      likesCount: nextLikesCount,
      authorId: post.authorId,
      targetText: post.text?.trim() ? post.text.slice(0, 60) : 'منشورك',
      mediaThumbnailUrl: firstMedia,
    };
  });

  if (!outcome) return null;
  if (outcome.isLiked) {
    await createAndEmitNotification({
      actorId,
      recipientId: outcome.authorId,
      kind: 'like',
      targetText: outcome.targetText,
      mediaThumbnailUrl: outcome.mediaThumbnailUrl,
    }).catch(() => undefined);
  }
  return { isLiked: outcome.isLiked, likesCount: outcome.likesCount };
}

export async function toggleRepostPostInDb(actorId: string, postId: string) {
  await ensureSeeded();
  const db = getDb();
  const outcome = await db.transaction(async (tx) => {
    const [post] = await tx
      .select({
        id: postsTable.id,
        authorId: postsTable.authorId,
        text: postsTable.text,
        repostsCount: postsTable.repostsCount,
      })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return null;

    const [existing] = await tx
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'post_repost'),
          eq(reactionsTable.targetId, postId)
        )
      )
      .limit(1);

    const nextReposted = !existing;
    if (nextReposted) {
      await tx.insert(reactionsTable).values({
        userId: actorId,
        targetType: 'post_repost',
        targetId: postId,
        value: '1',
      });
    } else {
      await tx
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.userId, actorId),
            eq(reactionsTable.targetType, 'post_repost'),
            eq(reactionsTable.targetId, postId)
          )
        );
    }

    const nextRepostsCount = nextReposted ? post.repostsCount + 1 : Math.max(0, post.repostsCount - 1);
    await tx
      .update(postsTable)
      .set({ repostsCount: nextRepostsCount })
      .where(eq(postsTable.id, postId));

    return {
      isReposted: nextReposted,
      repostsCount: nextRepostsCount,
      authorId: post.authorId,
      targetText: post.text?.trim() ? `أعاد نشر: ${post.text.slice(0, 50)}` : 'أعاد نشر منشورك',
    };
  });

  if (!outcome) return null;
  if (outcome.isReposted) {
    await createAndEmitNotification({
      actorId,
      recipientId: outcome.authorId,
      kind: 'system',
      targetText: outcome.targetText,
    }).catch(() => undefined);
  }
  return { isReposted: outcome.isReposted, repostsCount: outcome.repostsCount };
}

export async function toggleSavePostInDb(actorId: string, postId: string) {
  await ensureSeeded();
  const db = getDb();
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return null;

    const [existing] = await tx
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'post_save'),
          eq(reactionsTable.targetId, postId)
        )
      )
      .limit(1);

    const nextSaved = !existing;
    if (nextSaved) {
      await tx.insert(reactionsTable).values({
        userId: actorId,
        targetType: 'post_save',
        targetId: postId,
        value: '1',
      });
    } else {
      await tx
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.userId, actorId),
            eq(reactionsTable.targetType, 'post_save'),
            eq(reactionsTable.targetId, postId)
          )
        );
    }

    return { isSaved: nextSaved };
  });
}

export async function votePollInDb(actorId: string, postId: string, optionIndex: number) {
  await ensureSeeded();
  const db = getDb();
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: postsTable.id, pollJson: postsTable.pollJson })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post || !post.pollJson) return null;
    const poll = post.pollJson as NonNullable<Post['poll']>;

    const [existingVote] = await tx
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'poll_vote'),
          eq(reactionsTable.targetId, postId)
        )
      )
      .limit(1);

    if (existingVote) {
      return { ...poll, userVotedIndex: Number(existingVote.value) };
    }
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new DomainError(400, 'invalid_poll_option', 'خيار التصويت غير موجود');
    }

    await tx.insert(reactionsTable).values({
      userId: actorId,
      targetType: 'poll_vote',
      targetId: postId,
      value: String(optionIndex),
    });

    const storedPoll: NonNullable<Post['poll']> = {
      ...poll,
      options: poll.options.map((opt, idx) =>
        idx === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt
      ),
      totalVotes: poll.totalVotes + 1,
    };

    await tx
      .update(postsTable)
      .set({ pollJson: storedPoll })
      .where(eq(postsTable.id, postId));

    return { ...storedPoll, userVotedIndex: optionIndex };
  });
}

export async function addCommentToPostInDb(
  actorId: string,
  input: {
    id: string;
    postId: string;
    parentId?: string;
    text: string;
    createdAt?: string;
  }
) {
  await ensureSeeded();
  const db = getDb();
  const [post] = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      mediaJson: postsTable.mediaJson,
    })
    .from(postsTable)
    .where(eq(postsTable.id, input.postId))
    .limit(1);

  if (!post) {
    throw new DomainError(404, 'not_found', 'المنشور غير موجود');
  }

  if (actorId !== post.authorId) {
    const [authorRow] = await db
      .select({ settingsJson: usersTable.settingsJson })
      .from(usersTable)
      .where(eq(usersTable.id, post.authorId))
      .limit(1);
    const authorSettings = parseUserSettings(authorRow?.settingsJson);
    if (authorSettings.commentPermission === 'nobody') {
      throw new DomainError(403, 'comments_disabled', 'صاحب المنشور عطّل التعليقات');
    }
    if (authorSettings.commentPermission === 'followers') {
      const [followRow] = await db
        .select({ followerId: followsTable.followerId })
        .from(followsTable)
        .where(and(eq(followsTable.followerId, actorId), eq(followsTable.followeeId, post.authorId)))
        .limit(1);
      if (!followRow) {
        throw new DomainError(403, 'comments_followers_only', 'التعليقات متاحة للمتابعين فقط');
      }
    }
  }

  let parentCommentAuthorId: string | null = null;
  if (input.parentId) {
    const [parentComment] = await db
      .select({ id: commentsTable.id, postId: commentsTable.postId, authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, input.parentId))
      .limit(1);
    if (!parentComment || parentComment.postId !== input.postId) {
      throw new DomainError(404, 'parent_comment_not_found', 'التعليق الأصلي غير موجود');
    }
    parentCommentAuthorId = parentComment.authorId;
  }

  const nowTs = Date.now();
  const createdAt = input.createdAt ?? new Date(nowTs).toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(commentsTable).values({
      id: input.id,
      postId: input.postId,
      authorId: actorId,
      parentId: input.parentId ?? null,
      text: input.text,
      createdAt,
      likesCount: 0,
      isLiked: false,
      sortTs: nowTs,
    });

    await tx
      .update(postsTable)
      .set({ commentsCount: sql`${postsTable.commentsCount} + 1` })
      .where(eq(postsTable.id, input.postId));
  });

  const firstMedia = (post.mediaJson as Post['media'] | null)?.[0]?.url;
  await createAndEmitNotification({
    actorId,
    recipientId: post.authorId,
    kind: 'comment',
    targetText: input.text.slice(0, 60),
    mediaThumbnailUrl: firstMedia,
  }).catch(() => undefined);

  if (parentCommentAuthorId && parentCommentAuthorId !== post.authorId) {
    await createAndEmitNotification({
      actorId,
      recipientId: parentCommentAuthorId,
      kind: 'comment',
      targetText: `رد على تعليقك: ${input.text.slice(0, 50)}`,
      mediaThumbnailUrl: firstMedia,
    }).catch(() => undefined);
  }

  return { id: input.id, parentId: input.parentId ?? undefined, createdAt };
}

export async function likeCommentInDb(actorId: string, commentId: string) {
  await ensureSeeded();
  const db = getDb();
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .select({ id: commentsTable.id, likesCount: commentsTable.likesCount })
      .from(commentsTable)
      .where(eq(commentsTable.id, commentId))
      .limit(1);

    if (!comment) return null;

    const [existing] = await tx
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'comment_like'),
          eq(reactionsTable.targetId, commentId)
        )
      )
      .limit(1);

    const nextLiked = !existing;
    if (nextLiked) {
      await tx.insert(reactionsTable).values({
        userId: actorId,
        targetType: 'comment_like',
        targetId: commentId,
        value: '1',
      });
    } else {
      await tx
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.userId, actorId),
            eq(reactionsTable.targetType, 'comment_like'),
            eq(reactionsTable.targetId, commentId)
          )
        );
    }

    const nextLikesCount = nextLiked ? comment.likesCount + 1 : Math.max(0, comment.likesCount - 1);
    await tx
      .update(commentsTable)
      .set({ likesCount: nextLikesCount })
      .where(eq(commentsTable.id, commentId));

    return { isLiked: nextLiked, likesCount: nextLikesCount };
  });
}
