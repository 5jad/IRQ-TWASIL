import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import { ensureSeeded } from '../seed.ts';
import {
  blocksTable,
  closeFriendsTable,
  communitiesTable,
  communityMembersTable,
  conversationMembersTable,
  conversationsTable,
  followsTable,
  messagesTable,
  notificationsTable,
  postsTable,
  productsTable,
  savedCollectionItemsTable,
  savedCollectionsTable,
  usersTable,
} from '../schema.ts';
import {
  parseUserSettings,
  toPublicUser,
  type PublicUserDto,
  type UserSettings,
} from '../../server/dto.ts';
import { validateHandle } from '../../server/phone.ts';
import { deleteMediaByIdOrUrl } from '../../server/media.ts';
import { validateCanvasJson } from '../../lib/canvasSchema.ts';
import { canSendDirectMessage } from '../../lib/remediation.ts';
import { arabicTextMatches } from '../../lib/arabicSearch.ts';
import { canViewerSeePost } from '../../lib/visibility.ts';
import {
  DomainError,
  claimReadyMediaForUse,
  createAndEmitNotification,
  loadViewerPostReactionSets,
  loadViewerRelationships,
  mapPostRowToDto,
} from './shared.ts';
import type {
  ChatMessage,
  CommunityItem,
  Post,
  Product,
  SavedCollection,
} from '../../types/index.ts';

export async function startChatWithUserInDb(actorId: string, recipientId: string) {
  await ensureSeeded();
  const db = getDb();

  if (actorId === recipientId) {
    throw new DomainError(400, 'invalid_recipient', 'لا يمكنك بدء محادثة مع نفسك');
  }

  const [recipient] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, recipientId), eq(usersTable.status, 'active')))
    .limit(1);

  if (!recipient) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }

  const [block] = await db
    .select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerId, actorId), eq(blocksTable.blockedId, recipientId)),
        and(eq(blocksTable.blockerId, recipientId), eq(blocksTable.blockedId, actorId))
      )
    )
    .limit(1);

  if (block) {
    throw new DomainError(403, 'blocked', 'لا يمكن بدء محادثة مع مستخدم محظور');
  }

  const directKey = [actorId, recipientId].sort().join(':');
  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.directKey, directKey))
    .limit(1);

  const recipientSettings = parseUserSettings(recipient.settingsJson);
  const recipientLastSeenMs = recipient.lastSeenAt ? recipient.lastSeenAt.getTime() : 0;
  const recipientIsOnline =
    recipient.kind === 'bot' ||
    (recipientSettings.onlineStatusVisibility &&
      recipientLastSeenMs > 0 &&
      Date.now() - recipientLastSeenMs < 5 * 60 * 1000);

  if (existing) {
    return {
      id: existing.id,
      created: false,
      conversation: {
        id: existing.id,
        peerId: recipient.id,
        title: recipient.displayName,
        avatarUrl: recipient.avatarUrl,
        lastMessage: existing.lastMessage,
        lastMessageTime: existing.lastMessageTime,
        unreadCount: 0,
        isOnline: recipientIsOnline,
        isPinned: existing.isPinned,
        isMuted: existing.isMuted,
        isGroup: false,
        isBot: recipient.kind === 'bot',
        botId: recipient.kind === 'bot' ? recipient.id : undefined,
      },
    };
  }

  if (recipient.kind !== 'bot') {
    const [followRow] = await db
      .select({ followerId: followsTable.followerId })
      .from(followsTable)
      .where(and(eq(followsTable.followerId, actorId), eq(followsTable.followeeId, recipientId)))
      .limit(1);

    const dmAllowed = canSendDirectMessage({
      dmPermission: recipientSettings.dmPermission,
      senderFollowsRecipient: Boolean(followRow),
      isBot: recipient.kind === 'bot',
    });
    if (!dmAllowed) {
      throw new DomainError(403, 'dm_restricted', 'هذا المستخدم لا يستقبل رسائل جديدة وفق إعدادات الخصوصية');
    }
  }

  const nowTs = Date.now();
  const isoNow = new Date(nowTs).toISOString();
  const convId = `conv-${nowTs}-${Math.random().toString(36).slice(2, 7)}`;

  await db.transaction(async (tx) => {
    await tx.insert(conversationsTable).values({
      id: convId,
      directKey,
      title: recipient.displayName,
      avatarUrl: recipient.avatarUrl,
      lastMessage: 'بدأت محادثة جديدة',
      lastMessageTime: isoNow,
      unreadCount: 0,
      isOnline: recipientIsOnline,
      isPinned: false,
      isMuted: false,
      isGroup: false,
      sortTs: nowTs,
    });

    await tx.insert(conversationMembersTable).values([
      { conversationId: convId, userId: actorId, role: 'member', unreadCount: 0 },
      {
        conversationId: convId,
        userId: recipientId,
        role: recipient.kind === 'bot' ? 'bot' : 'member',
        unreadCount: 0,
      },
    ]);
  });

  return {
    id: convId,
    created: true,
    conversation: {
      id: convId,
      peerId: recipient.id,
      title: recipient.displayName,
      avatarUrl: recipient.avatarUrl,
      lastMessage: 'بدأت محادثة جديدة',
      lastMessageTime: isoNow,
      unreadCount: 0,
      isOnline: recipientIsOnline,
      isPinned: false,
      isMuted: false,
      isGroup: false,
      isBot: recipient.kind === 'bot',
      botId: recipient.kind === 'bot' ? recipient.id : undefined,
    },
  };
}

export async function assertConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const [member] = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversationId),
        eq(conversationMembersTable.userId, userId)
      )
    )
    .limit(1);
  return Boolean(member);
}

export async function getConversationMessagesInDb(
  actorId: string,
  conversationId: string,
  cursor?: string | null,
  limit = 50
): Promise<{ messages: ChatMessage[]; nextCursor: string | null; hasMore: boolean }> {
  await ensureSeeded();
  const isMember = await assertConversationMember(conversationId, actorId);
  if (!isMember) {
    throw new DomainError(404, 'not_found', 'المحادثة غير موجودة');
  }

  const db = getDb();
  const safeLimit = Math.max(1, Math.min(100, limit));
  const parsedCursor = cursor ? Number(cursor) : null;
  const cursorTs = parsedCursor !== null && Number.isFinite(parsedCursor) ? parsedCursor : null;

  const conditions = [
    eq(messagesTable.conversationId, conversationId),
    sql`${messagesTable.deletedAt} IS NULL`,
  ];
  if (cursorTs !== null) {
    conditions.push(lt(messagesTable.sortTs, cursorTs));
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(and(...conditions))
    .orderBy(desc(messagesTable.sortTs))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const pageRows = rows.slice(0, safeLimit);
  const nextCursor =
    hasMore && pageRows.length > 0 ? String(pageRows[pageRows.length - 1]!.sortTs) : null;

  const messages: ChatMessage[] = pageRows
    .slice()
    .reverse()
    .map((row) => ({
      id: row.id,
      senderId: row.senderId,
      text: row.text,
      timestamp: row.timestamp,
      isOwn: row.senderId === actorId,
      kind: row.kind as ChatMessage['kind'],
      status: row.status as ChatMessage['status'],
      voiceDuration: row.voiceDuration ?? undefined,
      reaction: row.reaction ?? undefined,
      mediaUrl: row.mediaUrl ?? undefined,
      replyMarkup: (row.replyMarkupJson as ChatMessage['replyMarkup'] | null) ?? undefined,
    }));

  return { messages, nextCursor, hasMore };
}

export async function sendChatMessageInDb(
  actorId: string,
  input: {
    id: string;
    conversationId: string;
    clientMsgId?: string;
    text: string;
    mediaId?: string;
    kind?: 'text' | 'image' | 'voice' | 'file';
    voiceDuration?: string;
    replyToMessageId?: string;
    replyMarkup?: unknown;
  }
) {
  await ensureSeeded();
  const db = getDb();

  const isMember = await assertConversationMember(input.conversationId, actorId);
  if (!isMember) {
    throw new DomainError(404, 'not_found', 'المحادثة غير موجودة');
  }

  if (input.clientMsgId) {
    const [existing] = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, input.conversationId),
          eq(messagesTable.senderId, actorId),
          eq(messagesTable.clientMsgId, input.clientMsgId)
        )
      )
      .limit(1);
    if (existing) {
      return {
        id: existing.id,
        lastMessageTime: new Date(existing.sortTs).toISOString(),
        deduplicated: true,
        mediaUrl: existing.mediaUrl ?? undefined,
      };
    }
  }

  let mediaUrl: string | null = null;
  if (input.mediaId) {
    const claimed = await claimReadyMediaForUse(
      input.mediaId,
      actorId,
      'message',
      input.id
    );
    mediaUrl = claimed.publicUrl;
  }

  const nowTs = Date.now();
  const isoNow = new Date(nowTs).toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(messagesTable).values({
      id: input.id,
      conversationId: input.conversationId,
      senderId: actorId,
      clientMsgId: input.clientMsgId ?? null,
      mediaId: input.mediaId ?? null,
      mediaUrl,
      text: input.text,
      timestamp: isoNow,
      isOwn: true,
      kind: input.kind ?? (mediaUrl ? 'image' : 'text'),
      status: 'sent',
      voiceDuration: input.voiceDuration ?? null,
      replyToMessageId: input.replyToMessageId ?? null,
      replyMarkupJson: input.replyMarkup ?? null,
      sortTs: nowTs,
    });

    await tx
      .update(conversationsTable)
      .set({
        lastMessage: input.text || (input.kind === 'voice' ? 'رسالة صوتية' : 'وسائط مرفقة'),
        lastMessageTime: isoNow,
        sortTs: nowTs,
      })
      .where(eq(conversationsTable.id, input.conversationId));

    await tx
      .update(conversationMembersTable)
      .set({ unreadCount: sql`${conversationMembersTable.unreadCount} + 1` })
      .where(
        and(
          eq(conversationMembersTable.conversationId, input.conversationId),
          sql`${conversationMembersTable.userId} <> ${actorId}`
        )
      );
  });

  return { id: input.id, lastMessageTime: isoNow, mediaUrl: mediaUrl ?? undefined };
}

export async function markConversationReadInDb(actorId: string, conversationId: string) {
  await ensureSeeded();
  const db = getDb();
  const isMember = await assertConversationMember(conversationId, actorId);
  if (!isMember) {
    throw new DomainError(404, 'not_found', 'المحادثة غير موجودة');
  }
  await db
    .update(conversationMembersTable)
    .set({ unreadCount: 0, lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversationId),
        eq(conversationMembersTable.userId, actorId)
      )
    );
  return { ok: true };
}

export async function toggleFollowUserInDb(actorId: string, targetUserId: string) {
  await ensureSeeded();
  if (actorId === targetUserId) {
    throw new DomainError(400, 'cannot_follow_self', 'لا يمكنك متابعة حسابك');
  }
  const db = getDb();

  const outcome = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: usersTable.id, followersCount: usersTable.followersCount, status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1);

    if (!target || target.status !== 'active') return null;

    const [block] = await tx
      .select()
      .from(blocksTable)
      .where(
        or(
          and(eq(blocksTable.blockerId, actorId), eq(blocksTable.blockedId, targetUserId)),
          and(eq(blocksTable.blockerId, targetUserId), eq(blocksTable.blockedId, actorId))
        )
      )
      .limit(1);
    if (block) {
      throw new DomainError(403, 'blocked', 'لا يمكن متابعة مستخدم محظور');
    }

    const [existing] = await tx
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, actorId), eq(followsTable.followeeId, targetUserId)))
      .limit(1);

    const nextFollowing = !existing;
    if (nextFollowing) {
      await tx.insert(followsTable).values({ followerId: actorId, followeeId: targetUserId });
    } else {
      await tx
        .delete(followsTable)
        .where(and(eq(followsTable.followerId, actorId), eq(followsTable.followeeId, targetUserId)));
    }

    const nextFollowers = nextFollowing
      ? target.followersCount + 1
      : Math.max(0, target.followersCount - 1);

    await tx
      .update(usersTable)
      .set({ followersCount: nextFollowers })
      .where(eq(usersTable.id, targetUserId));

    await tx
      .update(usersTable)
      .set({
        followingCount: nextFollowing
          ? sql`${usersTable.followingCount} + 1`
          : sql`GREATEST(0, ${usersTable.followingCount} - 1)`,
      })
      .where(eq(usersTable.id, actorId));

    return { isFollowing: nextFollowing, followersCount: nextFollowers };
  });

  if (!outcome) return null;
  if (outcome.isFollowing) {
    await createAndEmitNotification({
      actorId,
      recipientId: targetUserId,
      kind: 'follow',
      targetText: 'بدأ بمتابعتك',
    }).catch(() => undefined);
  }
  return outcome;
}

export async function toggleCloseFriendInDb(actorId: string, friendId: string) {
  if (actorId === friendId) {
    throw new DomainError(400, 'invalid_friend', 'لا يمكنك إضافة نفسك');
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(closeFriendsTable)
    .where(and(eq(closeFriendsTable.ownerId, actorId), eq(closeFriendsTable.friendId, friendId)))
    .limit(1);

  if (existing) {
    await db
      .delete(closeFriendsTable)
      .where(and(eq(closeFriendsTable.ownerId, actorId), eq(closeFriendsTable.friendId, friendId)));
    return { isCloseFriend: false };
  }
  await db.insert(closeFriendsTable).values({ ownerId: actorId, friendId });
  return { isCloseFriend: true };
}

export async function blockUserInDb(actorId: string, blockedId: string) {
  if (actorId === blockedId) {
    throw new DomainError(400, 'invalid_block', 'لا يمكنك حظر نفسك');
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(blocksTable).values({ blockerId: actorId, blockedId }).onConflictDoNothing();
    await tx
      .delete(followsTable)
      .where(
        or(
          and(eq(followsTable.followerId, actorId), eq(followsTable.followeeId, blockedId)),
          and(eq(followsTable.followerId, blockedId), eq(followsTable.followeeId, actorId))
        )
      );
    await tx
      .delete(closeFriendsTable)
      .where(
        or(
          and(eq(closeFriendsTable.ownerId, actorId), eq(closeFriendsTable.friendId, blockedId)),
          and(eq(closeFriendsTable.ownerId, blockedId), eq(closeFriendsTable.friendId, actorId))
        )
      );
  });
  return { blocked: true };
}

export async function unblockUserInDb(actorId: string, blockedId: string) {
  const db = getDb();
  await db
    .delete(blocksTable)
    .where(and(eq(blocksTable.blockerId, actorId), eq(blocksTable.blockedId, blockedId)));
  return { blocked: false };
}

export async function updateCurrentUserInDb(
  actorId: string,
  updates: {
    displayName?: string;
    handle?: string;
    bio?: string;
    province?: string;
    city?: string;
    avatarMediaId?: string;
    coverMediaId?: string;
    accountType?: 'personal' | 'creator' | 'merchant';
    canvasConfig?: Record<string, unknown> | null;
  }
) {
  await ensureSeeded();
  const db = getDb();
  const patch: Partial<typeof usersTable.$inferInsert> = {};

  const [existingUserRow] = await db
    .select({
      avatarUrl: usersTable.avatarUrl,
      coverUrl: usersTable.coverUrl,
      handle: usersTable.handle,
      username: usersTable.username,
      handleChangedAt: usersTable.handleChangedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, actorId))
    .limit(1);

  if (!existingUserRow) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }

  if (typeof updates.displayName === 'string') patch.displayName = updates.displayName;
  if (typeof updates.bio === 'string') patch.bio = updates.bio;
  if (typeof updates.province === 'string') patch.province = updates.province;
  if (typeof updates.city === 'string') patch.city = updates.city;
  if (typeof updates.accountType === 'string') patch.accountType = updates.accountType;

  if (updates.canvasConfig !== undefined) {
    if (updates.canvasConfig === null) {
      patch.canvasConfigJson = null;
    } else {
      const checked = validateCanvasJson(updates.canvasConfig);
      if (!checked.valid || !checked.config) {
        throw new DomainError(400, 'invalid_canvas', checked.errors[0] ?? 'إعدادات اللوحة غير صالحة');
      }
      patch.canvasConfigJson = checked.config;
    }
  }

  let prevAvatarToDelete: string | null = null;
  let prevCoverToDelete: string | null = null;

  if (typeof updates.avatarMediaId === 'string') {
    const claimed = await claimReadyMediaForUse(updates.avatarMediaId, actorId, 'avatar', actorId);
    patch.avatarUrl = claimed.publicUrl;
    if (existingUserRow.avatarUrl && existingUserRow.avatarUrl.startsWith('/media/')) {
      prevAvatarToDelete = existingUserRow.avatarUrl;
    }
  }
  if (typeof updates.coverMediaId === 'string') {
    const claimed = await claimReadyMediaForUse(updates.coverMediaId, actorId, 'cover', actorId);
    patch.coverUrl = claimed.publicUrl;
    if (existingUserRow.coverUrl && existingUserRow.coverUrl.startsWith('/media/')) {
      prevCoverToDelete = existingUserRow.coverUrl;
    }
  }

  if (typeof updates.handle === 'string') {
    const check = validateHandle(updates.handle);
    if (!check.ok) {
      throw new DomainError(400, 'invalid_handle', check.message);
    }
    const normalizedHandle = check.handle;
    const existingOwnHandle = (existingUserRow.handle ?? existingUserRow.username ?? '').toLowerCase();
    if (normalizedHandle !== existingOwnHandle) {
      if (existingUserRow.handleChangedAt) {
        const msSinceChange = Date.now() - existingUserRow.handleChangedAt.getTime();
        const cooldownMs = 14 * 24 * 60 * 60 * 1000;
        if (msSinceChange < cooldownMs) {
          throw new DomainError(429, 'handle_cooldown', 'يمكنك تغيير اسم المستخدم مرة كل ١٤ يوماً');
        }
      }

      const [existingHandle] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            or(eq(usersTable.handle, normalizedHandle), eq(usersTable.username, normalizedHandle)),
            sql`${usersTable.id} <> ${actorId}`
          )
        )
        .limit(1);

      if (existingHandle) {
        throw new DomainError(409, 'handle_taken', 'اسم المستخدم مستعمل بالفعل');
      }
      patch.handle = normalizedHandle;
      patch.username = normalizedHandle;
      patch.handleChangedAt = new Date();
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(usersTable).set(patch).where(eq(usersTable.id, actorId));
  }

  if (prevAvatarToDelete && prevAvatarToDelete !== patch.avatarUrl) {
    await deleteMediaByIdOrUrl(null, prevAvatarToDelete).catch(() => undefined);
  }
  if (prevCoverToDelete && prevCoverToDelete !== patch.coverUrl) {
    await deleteMediaByIdOrUrl(null, prevCoverToDelete).catch(() => undefined);
  }

  const [updatedRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, actorId))
    .limit(1);

  if (!updatedRow) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }

  return { ok: true, ...toPublicUser(updatedRow) };
}

export async function updateUserSettingsInDb(actorId: string, partial: Partial<UserSettings>) {
  await ensureSeeded();
  const db = getDb();
  const [row] = await db
    .select({ settingsJson: usersTable.settingsJson, phoneHmac: usersTable.phoneHmac })
    .from(usersTable)
    .where(eq(usersTable.id, actorId))
    .limit(1);
  if (!row) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }
  if (partial.twoFactorEnabled === true && !row.phoneHmac) {
    throw new DomainError(
      400,
      'phone_required_for_2fa',
      'يرجى ربط رقم هاتف عراقي وتوثيقه أولاً لتفعيل التحقق الثنائي'
    );
  }
  const merged: UserSettings = {
    ...parseUserSettings(row.settingsJson),
    ...partial,
  };
  await db
    .update(usersTable)
    .set({ settingsJson: merged })
    .where(eq(usersTable.id, actorId));
  return { ok: true, settings: merged };
}

export async function markNotificationsReadInDb(
  actorId: string,
  input: { ids?: string[]; all?: boolean }
) {
  await ensureSeeded();
  const db = getDb();
  if (input.all) {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.recipientId, actorId));
    return { ok: true };
  }
  if (input.ids && input.ids.length > 0) {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.recipientId, actorId), inArray(notificationsTable.id, input.ids)));
  }
  return { ok: true };
}

export async function createSavedCollectionInDb(actorId: string, name: string): Promise<SavedCollection> {
  await ensureSeeded();
  const db = getDb();
  const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date();
  await db.insert(savedCollectionsTable).values({
    id,
    userId: actorId,
    name,
    createdAt,
  });
  return {
    id,
    userId: actorId,
    name,
    postIds: [],
    createdAt: createdAt.toISOString(),
  };
}

export async function deleteSavedCollectionInDb(actorId: string, collectionId: string) {
  const db = getDb();
  const [col] = await db
    .select({ id: savedCollectionsTable.id, userId: savedCollectionsTable.userId })
    .from(savedCollectionsTable)
    .where(eq(savedCollectionsTable.id, collectionId))
    .limit(1);
  if (!col) return null;
  if (col.userId !== actorId) {
    throw new DomainError(403, 'forbidden', 'لا يمكنك حذف مجموعة لا تملكها');
  }
  await db.delete(savedCollectionsTable).where(eq(savedCollectionsTable.id, collectionId));
  return { deleted: true };
}

export async function toggleSavedCollectionItemInDb(
  actorId: string,
  collectionId: string,
  postId: string
) {
  const db = getDb();
  const [col] = await db
    .select({ id: savedCollectionsTable.id, userId: savedCollectionsTable.userId })
    .from(savedCollectionsTable)
    .where(eq(savedCollectionsTable.id, collectionId))
    .limit(1);
  if (!col) return null;
  if (col.userId !== actorId) {
    throw new DomainError(403, 'forbidden', 'لا تملك صلاحية تعديل هذه المجموعة');
  }

  const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) {
    throw new DomainError(404, 'not_found', 'المنشور غير موجود');
  }

  const [existing] = await db
    .select()
    .from(savedCollectionItemsTable)
    .where(and(eq(savedCollectionItemsTable.collectionId, collectionId), eq(savedCollectionItemsTable.postId, postId)))
    .limit(1);

  if (existing) {
    await db
      .delete(savedCollectionItemsTable)
      .where(and(eq(savedCollectionItemsTable.collectionId, collectionId), eq(savedCollectionItemsTable.postId, postId)));
    return { added: false };
  }
  await db.insert(savedCollectionItemsTable).values({ collectionId, postId });
  return { added: true };
}

export async function searchPlatformInDb(
  viewerId: string | null,
  query: string,
  type: 'all' | 'users' | 'posts' | 'products' | 'communities' = 'all'
): Promise<{
  users: PublicUserDto[];
  posts: Post[];
  products: Product[];
  communities: CommunityItem[];
}> {
  await ensureSeeded();
  const trimmed = query.trim();
  if (!trimmed) {
    return { users: [], posts: [], products: [], communities: [] };
  }

  const db = getDb();
  const rel = await loadViewerRelationships(viewerId);
  const visibilityCtx = {
    viewerId: rel.viewerId,
    followingSet: rel.followingSet,
    closeFriendOfSet: rel.closeFriendOfSet,
    blockedIds: rel.blockedIds,
  };

  const wantUsers = type === 'all' || type === 'users';
  const wantPosts = type === 'all' || type === 'posts';
  const wantProducts = type === 'all' || type === 'products';
  const wantCommunities = type === 'all' || type === 'communities';

  const [userRows, postRows, productRows, communityRows, viewerCommunityRows] = await Promise.all([
    wantUsers || wantPosts
      ? db
          .select()
          .from(usersTable)
          .where(eq(usersTable.status, 'active'))
          .orderBy(asc(usersTable.sortOrder))
          .limit(500)
      : Promise.resolve([]),
    wantPosts
      ? db.select().from(postsTable).orderBy(desc(postsTable.sortTs)).limit(300)
      : Promise.resolve([]),
    wantProducts
      ? db.select().from(productsTable).orderBy(asc(productsTable.sortOrder)).limit(300)
      : Promise.resolve([]),
    wantCommunities
      ? db.select().from(communitiesTable).orderBy(desc(communitiesTable.sortTs)).limit(150)
      : Promise.resolve([]),
    wantCommunities && viewerId
      ? db
          .select({ communityId: communityMembersTable.communityId })
          .from(communityMembersTable)
          .where(eq(communityMembersTable.userId, viewerId))
      : Promise.resolve([]),
  ]);

  const activeUsersMap = new Map<string, PublicUserDto>();
  const matchedUsers: PublicUserDto[] = [];
  for (const row of userRows) {
    if (rel.blockedIds.has(row.id)) continue;
    const dto = toPublicUser(row, {
      isCloseFriend: rel.closeFriendSet.has(row.id),
      isFollowing: rel.followingSet.has(row.id),
      isFollowedBy: rel.followedBySet.has(row.id),
    });
    activeUsersMap.set(row.id, dto);
    if (
      wantUsers &&
      matchedUsers.length < 20 &&
      arabicTextMatches(
        `${dto.displayName} ${dto.username} ${dto.handle ?? ''} ${dto.bio} ${dto.province}`,
        trimmed
      )
    ) {
      matchedUsers.push(dto);
    }
  }

  const matchedPostRows: Array<typeof postsTable.$inferSelect> = [];
  if (wantPosts) {
    for (const row of postRows) {
      if (!canViewerSeePost(row.authorId, row.audience, visibilityCtx)) continue;
      const author = activeUsersMap.get(row.authorId);
      if (!author) continue;
      const hay = `${row.text} ${author.displayName} ${author.username} ${row.location ?? ''} ${author.province}`;
      if (!arabicTextMatches(hay, trimmed)) continue;
      matchedPostRows.push(row);
      if (matchedPostRows.length >= 20) break;
    }
  }

  const reactionSets = await loadViewerPostReactionSets(
    viewerId,
    matchedPostRows.map((r) => r.id)
  );
  const matchedPosts: Post[] = [];
  for (const row of matchedPostRows) {
    const author = activeUsersMap.get(row.authorId);
    if (!author) continue;
    const dto = mapPostRowToDto(row, author, {
      viewerId,
      likedSet: reactionSets.likedSet,
      savedSet: reactionSets.savedSet,
      repostedSet: reactionSets.repostedSet,
      pollVotesMap: reactionSets.pollVotesMap,
    });
    if (dto) matchedPosts.push(dto);
  }

  const matchedProducts: Product[] = [];
  if (wantProducts) {
    for (const row of productRows) {
      const hay = `${row.title} ${row.shopName} ${row.city} ${row.province} ${row.category}`;
      if (!arabicTextMatches(hay, trimmed)) continue;
      matchedProducts.push({
        id: row.id,
        sellerId: row.sellerId ?? undefined,
        title: row.title,
        priceIqd: row.priceIqd,
        compareAtPriceIqd: row.compareAtPriceIqd ?? undefined,
        shopName: row.shopName,
        shopVerified: row.shopVerified,
        city: row.city,
        province: row.province,
        category: row.category,
        condition: row.condition as Product['condition'],
        imageUrl: row.imageUrl,
        inStock: row.inStock,
        ratingAvg: row.ratingAvg,
        reviewCount: row.reviewCount,
      });
      if (matchedProducts.length >= 20) break;
    }
  }

  const joinedCommSet = new Set(viewerCommunityRows.map((c) => c.communityId));
  const matchedCommunities: CommunityItem[] = [];
  if (wantCommunities) {
    for (const row of communityRows) {
      const hay = `${row.name} ${row.description} ${row.province} ${row.category}`;
      if (!arabicTextMatches(hay, trimmed)) continue;
      matchedCommunities.push({
        id: row.id,
        creatorId: row.creatorId ?? undefined,
        name: row.name,
        membersCount: row.membersCount,
        province: row.province,
        category: row.category,
        isPrivate: row.isPrivate,
        isJoined: viewerId ? joinedCommSet.has(row.id) : false,
        description: row.description,
        icon: row.icon,
      });
      if (matchedCommunities.length >= 20) break;
    }
  }

  return {
    users: matchedUsers,
    posts: matchedPosts,
    products: matchedProducts,
    communities: matchedCommunities,
  };
}
