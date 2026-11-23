import crypto from 'node:crypto';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import {
  blocksTable,
  closeFriendsTable,
  followsTable,
  mediaTable,
  notificationsTable,
  postsTable,
  reactionsTable,
  usersTable,
} from '../schema.ts';
import {
  parseUserSettings,
  toPublicUser,
  type PublicUserDto,
  type SelfUserDto,
} from '../../server/dto.ts';
import { emitUserEvent } from '../../server/events.ts';
import type {
  AppNotification,
  ChatConversation,
  ChatMessage,
  CommunityItem,
  CommunityMessage,
  MarketOrder,
  Post,
  PostComment,
  PostProduct,
  Product,
  SavedCollection,
  SocialMoment,
  StoryItem,
  WalletTransaction,
} from '../../types/index.ts';

export class DomainError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

export type CommunityRow = CommunityItem;

export interface BootstrapPayload {
  authenticated: boolean;
  currentUser: SelfUserDto | null;
  users: PublicUserDto[];
  posts: Post[];
  postsNextCursor?: string | null;
  postsHasMore?: boolean;
  conversations: ChatConversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  products: Product[];
  orders: MarketOrder[];
  walletTransactions: WalletTransaction[];
  savedCollections: SavedCollection[];
  notifications: AppNotification[];
  communities: CommunityItem[];
  communityMessagesById: Record<string, CommunityMessage[]>;
  storiesByUser: Record<string, StoryItem[]>;
  socialMoments: SocialMoment[];
}

export interface ViewerRelationshipContext {
  viewerId: string | null;
  followingSet: Set<string>;
  followedBySet: Set<string>;
  closeFriendSet: Set<string>;
  closeFriendOfSet: Set<string>;
  blockedIds: Set<string>;
}

export async function loadViewerRelationships(
  viewerId: string | null
): Promise<ViewerRelationshipContext> {
  const followingSet = new Set<string>();
  const followedBySet = new Set<string>();
  const closeFriendSet = new Set<string>();
  const closeFriendOfSet = new Set<string>();
  const blockedIds = new Set<string>();

  if (!viewerId) {
    return {
      viewerId,
      followingSet,
      followedBySet,
      closeFriendSet,
      closeFriendOfSet,
      blockedIds,
    };
  }

  const db = getDb();
  const [followRows, cfRows, blockRows] = await Promise.all([
    db
      .select()
      .from(followsTable)
      .where(or(eq(followsTable.followerId, viewerId), eq(followsTable.followeeId, viewerId))),
    db
      .select()
      .from(closeFriendsTable)
      .where(or(eq(closeFriendsTable.ownerId, viewerId), eq(closeFriendsTable.friendId, viewerId))),
    db
      .select()
      .from(blocksTable)
      .where(or(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, viewerId))),
  ]);

  for (const f of followRows) {
    if (f.followerId === viewerId) followingSet.add(f.followeeId);
    if (f.followeeId === viewerId) followedBySet.add(f.followerId);
  }
  for (const cf of cfRows) {
    if (cf.ownerId === viewerId) closeFriendSet.add(cf.friendId);
    if (cf.friendId === viewerId) closeFriendOfSet.add(cf.ownerId);
  }
  for (const b of blockRows) {
    if (b.blockerId === viewerId) blockedIds.add(b.blockedId);
    if (b.blockedId === viewerId) blockedIds.add(b.blockerId);
  }

  return {
    viewerId,
    followingSet,
    followedBySet,
    closeFriendSet,
    closeFriendOfSet,
    blockedIds,
  };
}

export async function loadViewerPostReactionSets(
  viewerId: string | null,
  postIds: string[]
): Promise<{
  likedSet: Set<string>;
  savedSet: Set<string>;
  repostedSet: Set<string>;
  pollVotesMap: Map<string, number>;
}> {
  const likedSet = new Set<string>();
  const savedSet = new Set<string>();
  const repostedSet = new Set<string>();
  const pollVotesMap = new Map<string, number>();

  if (!viewerId || postIds.length === 0) {
    return { likedSet, savedSet, repostedSet, pollVotesMap };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.userId, viewerId),
        inArray(reactionsTable.targetId, postIds),
        inArray(reactionsTable.targetType, ['post_like', 'post_save', 'post_repost', 'poll_vote'])
      )
    );

  for (const r of rows) {
    if (r.targetType === 'post_like') likedSet.add(r.targetId);
    else if (r.targetType === 'post_save') savedSet.add(r.targetId);
    else if (r.targetType === 'post_repost') repostedSet.add(r.targetId);
    else if (r.targetType === 'poll_vote') {
      const idx = Number(r.value);
      if (Number.isInteger(idx)) pollVotesMap.set(r.targetId, idx);
    }
  }

  return { likedSet, savedSet, repostedSet, pollVotesMap };
}

export function mapPostRowToDto(
  row: typeof postsTable.$inferSelect,
  author: PublicUserDto,
  viewerState: {
    viewerId: string | null;
    likedSet: Set<string>;
    savedSet: Set<string>;
    repostedSet: Set<string>;
    pollVotesMap: Map<string, number>;
    comments?: PostComment[];
  }
): Post | null {
  const pollRaw = (row.pollJson as Post['poll'] | null) ?? undefined;
  const userVotedIndex = viewerState.viewerId ? viewerState.pollVotesMap.get(row.id) : undefined;
  const poll = pollRaw
    ? {
        ...pollRaw,
        userVotedIndex: userVotedIndex ?? undefined,
      }
    : undefined;

  const rawMedia = (row.mediaJson as Post['media'] | null) ?? undefined;
  const cleanMedia = rawMedia?.filter((m) => m.url && !m.url.startsWith('blob:'));
  if (!row.text?.trim() && (!cleanMedia || cleanMedia.length === 0) && !poll) {
    return null;
  }

  return {
    id: row.id,
    author,
    kind: row.kind as Post['kind'],
    text: row.text,
    media: cleanMedia && cleanMedia.length > 0 ? cleanMedia : undefined,
    poll,
    likesCount: row.likesCount,
    commentsCount: row.commentsCount,
    ...(viewerState.comments !== undefined ? { comments: viewerState.comments } : {}),
    repostsCount: row.repostsCount,
    isLiked: viewerState.viewerId ? viewerState.likedSet.has(row.id) : false,
    isSaved: viewerState.viewerId ? viewerState.savedSet.has(row.id) : false,
    isReposted: viewerState.viewerId ? viewerState.repostedSet.has(row.id) : false,
    taggedProducts: (row.taggedProductsJson as PostProduct[] | null) ?? undefined,
    createdAt: row.createdAt,
    location: row.location ?? undefined,
    audioTrack: row.audioTrack ?? undefined,
    audience: (row.audience as Post['audience']) ?? 'everyone',
    isSponsored: row.isSponsored || undefined,
  };
}

export async function createAndEmitNotification(input: {
  actorId: string;
  recipientId: string;
  kind: AppNotification['kind'];
  targetText: string;
  mediaThumbnailUrl?: string;
}): Promise<void> {
  if (!input.recipientId || input.recipientId === input.actorId) return;
  const db = getDb();
  const [actorRow, recipientRow] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, input.actorId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, input.recipientId)).limit(1),
  ]);
  const actor = actorRow[0];
  const recipient = recipientRow[0];
  if (!actor || !recipient || recipient.status !== 'active') return;

  const settings = parseUserSettings(recipient.settingsJson);
  if (input.kind === 'like' && !settings.notifyLikes) return;
  if (input.kind === 'comment' && !settings.notifyComments) return;
  if (input.kind === 'follow' && !settings.notifyFollows) return;
  if (input.kind === 'order' && !settings.notifyOrders) return;

  const id = `notif-${crypto.randomUUID().slice(0, 12)}`;
  const time = new Date().toISOString();
  const sortOrder = -Math.floor(Date.now() / 1000);

  await db.insert(notificationsTable).values({
    id,
    actorId: input.actorId,
    recipientId: input.recipientId,
    kind: input.kind,
    targetText: input.targetText,
    time,
    isRead: false,
    mediaThumbnailUrl: input.mediaThumbnailUrl ?? null,
    sortOrder,
  });

  await emitUserEvent(input.recipientId, 'notification:new', {
    id,
    actor: toPublicUser(actor),
    kind: input.kind,
    targetText: input.targetText,
    time,
    isRead: false,
    mediaThumbnailUrl: input.mediaThumbnailUrl,
  });
}

export async function claimReadyMediaForUse(
  mediaId: string,
  ownerId: string,
  usedByType: string,
  usedById: string
): Promise<{ publicUrl: string; thumbUrl: string | null; mime: string }> {
  const db = getDb();
  const [media] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, mediaId))
    .limit(1);

  if (!media) {
    throw new DomainError(400, 'invalid_media', 'الملف غير موجود أو غير صالح');
  }
  if (media.ownerId !== ownerId) {
    throw new DomainError(403, 'forbidden_media', 'لا تملك صلاحية استخدام هذا الملف');
  }
  if (media.status !== 'ready' || !media.publicUrl) {
    throw new DomainError(400, 'media_not_ready', 'الوسائط ما زالت قيد المعالجة أو غير جاهزة');
  }
  if (media.usedById !== null) {
    throw new DomainError(409, 'media_already_used', 'تم استخدام هذا الملف مسبقاً');
  }

  const [updated] = await db
    .update(mediaTable)
    .set({
      usedByType,
      usedById,
      usedAt: new Date(),
    })
    .where(and(eq(mediaTable.id, mediaId), sql`${mediaTable.usedById} IS NULL`))
    .returning();

  if (!updated) {
    throw new DomainError(409, 'media_already_used', 'تم استخدام هذا الملف مسبقاً');
  }

  return {
    publicUrl: updated.publicUrl!,
    thumbUrl: updated.thumbUrl,
    mime: updated.mime,
  };
}
