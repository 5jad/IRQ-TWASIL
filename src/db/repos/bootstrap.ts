import { and, asc, desc, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import { ensureSeeded } from '../seed.ts';
import {
  blocksTable,
  closeFriendsTable,
  communitiesTable,
  communityMembersTable,
  communityMessagesTable,
  conversationMembersTable,
  conversationsTable,
  followsTable,
  messagesTable,
  notificationsTable,
  ordersTable,
  postsTable,
  productsTable,
  reactionsTable,
  savedCollectionItemsTable,
  savedCollectionsTable,
  socialMomentsTable,
  storiesTable,
  storyViewsTable,
  usersTable,
  walletTransactionsTable,
} from '../schema.ts';
import {
  parseUserSettings,
  toPublicUser,
  toSelfUser,
  type PublicUserDto,
  type SelfUserDto,
} from '../../server/dto.ts';
import { resolveConversationPeer } from '../../lib/remediation.ts';
import { canViewerSeeMoment, canViewerSeePost, canViewerSeeStory } from '../../lib/visibility.ts';
import { mapPostRowToDto, type BootstrapPayload } from './shared.ts';
import type {
  AppNotification,
  ChatConversation,
  ChatMessage,
  CommunityItem,
  CommunityMessage,
  MarketOrder,
  Post,
  Product,
  SavedCollection,
  SocialMoment,
  StoryItem,
  StoryOverlayItem,
  WalletTransaction,
} from '../../types/index.ts';

const BOOTSTRAP_POST_LIMIT = 20;
const BOOTSTRAP_USER_LIMIT = 500;
const BOOTSTRAP_STORY_LIMIT = 200;
const BOOTSTRAP_MOMENT_LIMIT = 150;
const BOOTSTRAP_PRODUCT_LIMIT = 100;
const BOOTSTRAP_COMMUNITY_LIMIT = 50;
const BOOTSTRAP_MESSAGES_PER_COMMUNITY = 50;
const BOOTSTRAP_MESSAGES_PER_CONVERSATION = 50;
const BOOTSTRAP_NOTIFICATIONS_LIMIT = 60;
const BOOTSTRAP_ORDERS_LIMIT = 50;
const BOOTSTRAP_WALLET_TX_LIMIT = 50;

export async function getBootstrapData(
  viewerId: string | null,
  decryptedViewerPhone?: string | null
): Promise<BootstrapPayload> {
  await ensureSeeded();
  const db = getDb();

  const [
    userRows,
    storyRows,
    storyPollVoteRows,
    momentRows,
    productRows,
    communityRows,
  ] = await Promise.all([
    db
      .select()
      .from(usersTable)
      .where(eq(usersTable.status, 'active'))
      .orderBy(asc(usersTable.sortOrder))
      .limit(BOOTSTRAP_USER_LIMIT),
    db
      .select()
      .from(storiesTable)
      .where(ne(storiesTable.mode, 'reel'))
      .orderBy(asc(storiesTable.sortTs))
      .limit(BOOTSTRAP_STORY_LIMIT),
    db.select().from(reactionsTable).where(eq(reactionsTable.targetType, 'story_poll_vote')),
    db
      .select()
      .from(socialMomentsTable)
      .orderBy(desc(socialMomentsTable.sortTs))
      .limit(BOOTSTRAP_MOMENT_LIMIT),
    db
      .select()
      .from(productsTable)
      .orderBy(asc(productsTable.sortOrder))
      .limit(BOOTSTRAP_PRODUCT_LIMIT),
    db
      .select()
      .from(communitiesTable)
      .orderBy(desc(communitiesTable.sortTs))
      .limit(BOOTSTRAP_COMMUNITY_LIMIT),
  ]);

  const communityIds = communityRows.map((c) => c.id);
  const communityMessageRows =
    communityIds.length > 0
      ? await db
          .select()
          .from(communityMessagesTable)
          .where(inArray(communityMessagesTable.communityId, communityIds))
          .orderBy(desc(communityMessagesTable.sortTs))
          .limit(BOOTSTRAP_MESSAGES_PER_COMMUNITY * communityIds.length)
      : [];

  // Per-viewer relationship lookups
  const followingSet = new Set<string>();
  const followedBySet = new Set<string>();
  const closeFriendSet = new Set<string>();
  const closeFriendOfSet = new Set<string>();
  const blockedIds = new Set<string>();
  const viewedStorySet = new Set<string>();
  const postLikedSet = new Set<string>();
  const postSavedSet = new Set<string>();
  const postRepostedSet = new Set<string>();
  const productWishlistSet = new Set<string>();
  const pollVotesMap = new Map<string, number>();
  const viewerCommunitySet = new Set<string>();

  let memberConversations: Array<{
    conversationId: string;
    unreadCount: number;
  }> = [];
  let notificationRows: Array<typeof notificationsTable.$inferSelect> = [];
  let orderRows: Array<typeof ordersTable.$inferSelect> = [];
  let walletTxRows: Array<typeof walletTransactionsTable.$inferSelect> = [];
  let savedCollectionRows: Array<typeof savedCollectionsTable.$inferSelect> = [];
  let savedCollectionItemRows: Array<typeof savedCollectionItemsTable.$inferSelect> = [];

  if (viewerId) {
    const [
      followRows,
      cfRows,
      blockRows,
      storyViewRows,
      reactionRows,
      convMemberRows,
      notifRows,
      commMemberRows,
      ordRows,
      wTxRows,
      sCollRows,
    ] = await Promise.all([
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
      db.select().from(storyViewsTable).where(eq(storyViewsTable.viewerId, viewerId)),
      db.select().from(reactionsTable).where(eq(reactionsTable.userId, viewerId)),
      db
        .select({
          conversationId: conversationMembersTable.conversationId,
          unreadCount: conversationMembersTable.unreadCount,
        })
        .from(conversationMembersTable)
        .where(eq(conversationMembersTable.userId, viewerId)),
      db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.recipientId, viewerId))
        .orderBy(asc(notificationsTable.sortOrder))
        .limit(BOOTSTRAP_NOTIFICATIONS_LIMIT),
      db
        .select({ communityId: communityMembersTable.communityId })
        .from(communityMembersTable)
        .where(eq(communityMembersTable.userId, viewerId)),
      db
        .select()
        .from(ordersTable)
        .where(or(eq(ordersTable.buyerId, viewerId), eq(ordersTable.sellerId, viewerId)))
        .orderBy(desc(ordersTable.createdAt))
        .limit(BOOTSTRAP_ORDERS_LIMIT),
      db
        .select()
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.userId, viewerId))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(BOOTSTRAP_WALLET_TX_LIMIT),
      db
        .select()
        .from(savedCollectionsTable)
        .where(eq(savedCollectionsTable.userId, viewerId))
        .orderBy(desc(savedCollectionsTable.createdAt)),
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
    for (const sv of storyViewRows) {
      viewedStorySet.add(sv.storyId);
    }
    for (const r of reactionRows) {
      if (r.targetType === 'post_like') postLikedSet.add(r.targetId);
      else if (r.targetType === 'post_save') postSavedSet.add(r.targetId);
      else if (r.targetType === 'post_repost') postRepostedSet.add(r.targetId);
      else if (r.targetType === 'product_wishlist') productWishlistSet.add(r.targetId);
      else if (r.targetType === 'poll_vote') {
        const idx = Number(r.value);
        if (Number.isInteger(idx)) pollVotesMap.set(r.targetId, idx);
      }
    }
    for (const cm of commMemberRows) {
      viewerCommunitySet.add(cm.communityId);
    }
    memberConversations = convMemberRows;
    notificationRows = notifRows;
    orderRows = ordRows;
    walletTxRows = wTxRows;
    savedCollectionRows = sCollRows;

    if (sCollRows.length > 0) {
      savedCollectionItemRows = await db
        .select()
        .from(savedCollectionItemsTable)
        .where(inArray(savedCollectionItemsTable.collectionId, sCollRows.map((c) => c.id)));
    }
  }

  const storyPollAggregate = new Map<string, Map<number, number>>();
  const viewerStoryPollChoice = new Map<string, number>();
  for (const row of storyPollVoteRows) {
    const idx = Number(row.value);
    if (!Number.isInteger(idx) || idx < 0) continue;
    let counts = storyPollAggregate.get(row.targetId);
    if (!counts) {
      counts = new Map<number, number>();
      storyPollAggregate.set(row.targetId, counts);
    }
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
    if (viewerId && row.userId === viewerId) {
      viewerStoryPollChoice.set(row.targetId, idx);
    }
  }

  const nowMs = Date.now();
  const storiesByUser: Record<string, StoryItem[]> = {};
  const unseenAuthorSet = new Set<string>();

  const visibilityCtx = {
    viewerId,
    followingSet,
    closeFriendOfSet,
    blockedIds,
  };

  for (const row of storyRows) {
    if (row.mode === 'instants' || row.mode === 'reel') continue;
    if (row.mediaUrl && row.mediaUrl.startsWith('blob:')) continue;
    if (row.mediaType !== 'text' && !row.mediaUrl) continue;
    const expMs = Date.parse(row.expiresAt);
    if (!Number.isNaN(expMs) && expMs <= nowMs) continue;

    const rawOv = row.overlaysJson as
      | StoryOverlayItem[]
      | {
          items?: StoryOverlayItem[];
          soundId?: string;
          videoVolume?: number;
          musicVolume?: number;
          soundStartSec?: number;
          kind?: StoryItem['kind'];
          recipientIds?: string[];
        }
      | null;
    const overlays = Array.isArray(rawOv) ? rawOv : rawOv?.items;
    const meta = !Array.isArray(rawOv) && rawOv ? rawOv : undefined;

    if (!canViewerSeeStory(row.authorId, row.audience, meta?.recipientIds, visibilityCtx)) {
      continue;
    }

    if (!storiesByUser[row.authorId]) {
      storiesByUser[row.authorId] = [];
    }

    const pollSticker = overlays?.find((o) => o.kind === 'sticker' && o.stickerKind === 'poll');
    const optionLen = pollSticker?.pollOptions?.length ?? 2;
    const countsMap = storyPollAggregate.get(row.id);
    const pollVotes = pollSticker
      ? Array.from({ length: optionLen }, (_, i) => countsMap?.get(i) ?? 0)
      : undefined;

    storiesByUser[row.authorId].push({
      id: row.id,
      authorId: row.authorId,
      kind: meta?.kind ?? 'story',
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType as StoryItem['mediaType'],
      caption: row.caption ?? undefined,
      soundId: meta?.soundId,
      soundTitle: row.soundTitle ?? undefined,
      videoVolume: meta?.videoVolume,
      musicVolume: meta?.musicVolume,
      soundStartSec: meta?.soundStartSec,
      durationSec: row.durationSec,
      audience: row.audience as StoryItem['audience'],
      recipientIds: meta?.recipientIds,
      mode: row.mode as StoryItem['mode'],
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      expiresHint: row.expiresHint ?? undefined,
      bgGradient: row.bgGradient ?? undefined,
      overlays: overlays ?? undefined,
      pollVotes,
      userVotedOptionIndex: viewerStoryPollChoice.get(row.id),
    });

    if (viewerId && !viewedStorySet.has(row.id)) {
      unseenAuthorSet.add(row.authorId);
    }
  }

  const visibleUserRows = userRows.filter((u) => !blockedIds.has(u.id));
  const users: PublicUserDto[] = visibleUserRows.map((row) =>
    toPublicUser(row, {
      hasUnseenStory: unseenAuthorSet.has(row.id),
      isCloseFriend: closeFriendSet.has(row.id),
      isFollowing: followingSet.has(row.id),
      isFollowedBy: followedBySet.has(row.id),
    })
  );

  for (const u of users) {
    u.hasActiveStory = Boolean(storiesByUser[u.id] && storiesByUser[u.id]!.length > 0);
  }

  const userMap = new Map<string, PublicUserDto>(users.map((u) => [u.id, u]));
  const lastSeenMsByUserId: Record<string, number> = {};
  const onlineVisibilityByUserId: Record<string, boolean> = {};
  for (const row of visibleUserRows) {
    if (row.lastSeenAt) {
      lastSeenMsByUserId[row.id] = row.lastSeenAt.getTime();
    }
    onlineVisibilityByUserId[row.id] = parseUserSettings(row.settingsJson).onlineStatusVisibility;
  }

  const rawSelfRow = viewerId ? visibleUserRows.find((u) => u.id === viewerId) ?? null : null;
  const currentUser: SelfUserDto | null = rawSelfRow
    ? toSelfUser(
        rawSelfRow,
        {
          hasUnseenStory: unseenAuthorSet.has(rawSelfRow.id),
          isCloseFriend: false,
          isFollowing: false,
          isFollowedBy: false,
        },
        decryptedViewerPhone
      )
    : null;

  const fallbackAuthor: PublicUserDto =
    users[0] ?? {
      id: 'system',
      username: 'tawasul',
      displayName: 'تواصل',
      avatarUrl: '',
      bio: '',
      province: 'بغداد',
      isVerified: false,
      verifiedKind: 'none',
      accountType: 'personal',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    };

  // Bounded feed pagination: collect top 20 visible posts + lookahead 1 for exact hasMore/nextCursor.
  // Comments are omitted from feed list items and fetched lazily when PostCommentsSheet opens.
  const collectedPostItems: Array<{ post: Post; sortTs: number }> = [];
  let cursorTs: number | null = null;
  let dbExhausted = false;
  const batchLimit = 60;

  while (collectedPostItems.length <= BOOTSTRAP_POST_LIMIT && !dbExhausted) {
    const batch = await db
      .select()
      .from(postsTable)
      .where(cursorTs !== null ? lt(postsTable.sortTs, cursorTs) : undefined)
      .orderBy(desc(postsTable.sortTs))
      .limit(batchLimit);

    if (batch.length < batchLimit) {
      dbExhausted = true;
    }
    if (batch.length === 0) break;

    cursorTs = batch[batch.length - 1]!.sortTs;

    for (const row of batch) {
      if (!canViewerSeePost(row.authorId, row.audience, visibilityCtx)) continue;
      const author = userMap.get(row.authorId);
      if (!author) continue;
      const mapped = mapPostRowToDto(row, author, {
        viewerId,
        likedSet: postLikedSet,
        savedSet: postSavedSet,
        repostedSet: postRepostedSet,
        pollVotesMap,
      });
      if (!mapped) continue;
      collectedPostItems.push({ post: mapped, sortTs: row.sortTs });
      if (collectedPostItems.length > BOOTSTRAP_POST_LIMIT) break;
    }
  }

  const postsHasMore = collectedPostItems.length > BOOTSTRAP_POST_LIMIT;
  const pageItems = collectedPostItems.slice(0, BOOTSTRAP_POST_LIMIT);
  const posts: Post[] = pageItems.map((item) => item.post);
  const postsNextCursor =
    postsHasMore && pageItems.length > 0
      ? String(pageItems[pageItems.length - 1]!.sortTs)
      : null;

  // Conversations & bounded recent messages per conversation
  const conversations: ChatConversation[] = [];
  const messagesByConversation: Record<string, ChatMessage[]> = {};

  if (viewerId && memberConversations.length > 0) {
    const convIds = memberConversations.map((m) => m.conversationId);
    const unreadMap = new Map(memberConversations.map((m) => [m.conversationId, m.unreadCount]));

    const [convRows, msgRows, allConvMemberRows] = await Promise.all([
      db
        .select()
        .from(conversationsTable)
        .where(inArray(conversationsTable.id, convIds))
        .orderBy(desc(conversationsTable.sortTs)),
      db
        .select()
        .from(messagesTable)
        .where(
          and(
            inArray(messagesTable.conversationId, convIds),
            sql`${messagesTable.deletedAt} IS NULL`
          )
        )
        .orderBy(desc(messagesTable.sortTs))
        .limit(BOOTSTRAP_MESSAGES_PER_CONVERSATION * convIds.length),
      db
        .select()
        .from(conversationMembersTable)
        .where(inArray(conversationMembersTable.conversationId, convIds)),
    ]);

    const membersByConv = new Map<string, PublicUserDto[]>();
    for (const cm of allConvMemberRows) {
      const u = userMap.get(cm.userId);
      if (!u) continue;
      const list = membersByConv.get(cm.conversationId) ?? [];
      list.push(u);
      membersByConv.set(cm.conversationId, list);
    }

    for (const row of convRows) {
      const resolved = resolveConversationPeer({
        viewerId,
        isGroup: row.isGroup,
        memberUsers: membersByConv.get(row.id) ?? [],
        storedTitle: row.title,
        storedAvatarUrl: row.avatarUrl,
        storedIsOnline: row.isOnline,
        lastSeenMsByUserId,
        onlineVisibilityByUserId,
        nowMs,
      });

      conversations.push({
        id: row.id,
        peerId: resolved.peerId,
        title: resolved.title,
        avatarUrl: resolved.avatarUrl,
        lastMessage: row.lastMessage,
        lastMessageTime: row.lastMessageTime,
        unreadCount: unreadMap.get(row.id) ?? 0,
        isOnline: resolved.isOnline,
        isPinned: row.isPinned,
        isMuted: row.isMuted,
        isGroup: row.isGroup,
        isBot: resolved.isBot || undefined,
        botId: resolved.botId,
        orderNumber: row.orderNumber ?? undefined,
      });
      messagesByConversation[row.id] = [];
    }

    for (const row of msgRows) {
      const arr = messagesByConversation[row.conversationId];
      if (!arr || arr.length >= BOOTSTRAP_MESSAGES_PER_CONVERSATION) continue;
      arr.push({
        id: row.id,
        senderId: row.senderId,
        text: row.text,
        timestamp: row.timestamp,
        isOwn: row.senderId === viewerId,
        kind: row.kind as ChatMessage['kind'],
        status: row.status as ChatMessage['status'],
        voiceDuration: row.voiceDuration ?? undefined,
        reaction: row.reaction ?? undefined,
        mediaUrl: row.mediaUrl ?? undefined,
        replyMarkup: (row.replyMarkupJson as ChatMessage['replyMarkup'] | null) ?? undefined,
      });
    }

    // Reverse each conversation bucket so messages render in chronological ascending order
    for (const convId of Object.keys(messagesByConversation)) {
      messagesByConversation[convId]!.reverse();
    }
  }

  const products: Product[] = productRows.map((row) => ({
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
    isWishlisted: viewerId ? productWishlistSet.has(row.id) : false,
  }));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const orders: MarketOrder[] = orderRows.map((o) => {
    const prod = productMap.get(o.productId);
    return {
      id: o.id,
      buyerId: o.buyerId,
      sellerId: o.sellerId ?? undefined,
      productId: o.productId,
      productTitle: prod?.title ?? 'منتج',
      productImageUrl: prod?.imageUrl ?? '',
      priceIqd: o.priceIqd,
      status: o.status as MarketOrder['status'],
      note: o.note,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });

  const walletTransactions: WalletTransaction[] = walletTxRows.map((w) => ({
    id: w.id,
    userId: w.userId,
    kind: w.kind as WalletTransaction['kind'],
    amountCoins: w.amountCoins,
    description: w.description,
    relatedUserId: w.relatedUserId ?? undefined,
    createdAt: w.createdAt.toISOString(),
  }));

  const itemsByCollection = new Map<string, string[]>();
  for (const item of savedCollectionItemRows) {
    const arr = itemsByCollection.get(item.collectionId) ?? [];
    arr.push(item.postId);
    itemsByCollection.set(item.collectionId, arr);
  }
  const savedCollections: SavedCollection[] = savedCollectionRows.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    postIds: itemsByCollection.get(c.id) ?? [],
    createdAt: c.createdAt.toISOString(),
  }));

  const notifications: AppNotification[] = viewerId
    ? notificationRows.map((row) => ({
        id: row.id,
        actor: userMap.get(row.actorId) ?? fallbackAuthor,
        kind: (row.kind === 'mention' ? 'system' : row.kind) as AppNotification['kind'],
        targetText: row.targetText,
        time: row.time,
        isRead: row.isRead,
        mediaThumbnailUrl: row.mediaThumbnailUrl ?? undefined,
      }))
    : [];

  const communities: CommunityItem[] = communityRows.map((row) => ({
    id: row.id,
    creatorId: row.creatorId ?? undefined,
    name: row.name,
    membersCount: row.membersCount,
    province: row.province,
    category: row.category,
    isPrivate: row.isPrivate,
    isJoined: viewerId ? viewerCommunitySet.has(row.id) : false,
    description: row.description,
    icon: row.icon,
  }));

  const communityMessagesById: Record<string, CommunityMessage[]> = {};
  for (const cm of communityMessageRows) {
    if (blockedIds.has(cm.senderId)) continue;
    const list = communityMessagesById[cm.communityId] ?? [];
    if (list.length >= BOOTSTRAP_MESSAGES_PER_COMMUNITY) continue;
    list.push({
      id: cm.id,
      communityId: cm.communityId,
      senderId: cm.senderId,
      sender: userMap.get(cm.senderId),
      channel: (cm.channel as 'general' | 'announcements') ?? 'general',
      text: cm.text,
      createdAt: cm.createdAt.toISOString(),
    });
    communityMessagesById[cm.communityId] = list;
  }
  for (const commId of Object.keys(communityMessagesById)) {
    communityMessagesById[commId]!.reverse();
  }

  const socialMoments: SocialMoment[] = [];
  for (const m of momentRows) {
    const expMs = Date.parse(m.expiresAt);
    if (!Number.isNaN(expMs) && expMs <= nowMs) continue;
    if (!canViewerSeeMoment(m.authorId, m.audience, visibilityCtx)) continue;
    socialMoments.push({
      id: m.id,
      kind: m.kind as 'note' | 'instant',
      authorId: m.authorId,
      text: m.text ?? undefined,
      mediaUrl: m.mediaUrl ?? undefined,
      mediaType: (m.mediaType as 'image' | 'video' | undefined) ?? undefined,
      soundId: m.soundId ?? undefined,
      audience: m.audience as SocialMoment['audience'],
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
    });
  }

  return {
    authenticated: Boolean(currentUser),
    currentUser,
    users,
    posts,
    postsNextCursor,
    postsHasMore,
    conversations,
    messagesByConversation,
    products,
    orders,
    walletTransactions,
    savedCollections,
    notifications,
    communities,
    communityMessagesById,
    storiesByUser,
    socialMoments,
  };
}
