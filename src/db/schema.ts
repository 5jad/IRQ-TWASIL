import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  real,
  jsonb,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('tw_users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  handle: text('handle').unique(),
  email: text('email').unique(),
  handleChangedAt: timestamp('handle_changed_at'),
  phoneEnc: text('phone_enc'),
  phoneHmac: text('phone_hmac').unique(),
  phoneVerifiedAt: timestamp('phone_verified_at'),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  coverUrl: text('cover_url'),
  bio: text('bio').notNull().default(''),
  province: text('province').notNull().default('بغداد'),
  city: text('city'),
  isVerified: boolean('is_verified').notNull().default(false),
  verifiedKind: text('verified_kind').notNull().default('none'),
  accountType: text('account_type').notNull().default('personal'),
  role: text('role').notNull().default('user'),
  kind: text('kind').notNull().default('person'), // 'person' | 'bot'
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'deleted'
  deletedAt: timestamp('deleted_at'),
  birthYear: integer('birth_year'),
  lastSeenAt: timestamp('last_seen_at'),
  followersCount: integer('followers_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  postsCount: integer('posts_count').notNull().default(0),
  hasActiveStory: boolean('has_active_story').notNull().default(false),
  // Bot-specific fields (when kind === 'bot')
  ownerId: text('owner_id'),
  botDescription: text('bot_description'),
  botShortDescription: text('bot_short_description'),
  botAvatarMediaId: text('bot_avatar_media_id'),
  botPrivacyMode: boolean('bot_privacy_mode').notNull().default(true),
  botCanJoinGroups: boolean('bot_can_join_groups').notNull().default(true),
  botIsListed: boolean('bot_is_listed').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  canvasConfigJson: jsonb('canvas_config_json'),
  settingsJson: jsonb('settings_json'),
  walletBalance: integer('wallet_balance').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const followsTable = pgTable(
  'tw_follows',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('tw_follows_followee_idx').on(t.followeeId),
  ]
);

export const closeFriendsTable = pgTable(
  'tw_close_friends',
  {
    ownerId: text('owner_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    friendId: text('friend_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.friendId] })]
);

export const blocksTable = pgTable(
  'tw_blocks',
  {
    blockerId: text('blocker_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]
);

export const mediaTable = pgTable(
  'tw_media',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'ready' | 'failed' | 'deleted'
    stagingKey: text('staging_key').notNull(),
    publicKey: text('public_key'),
    thumbKey: text('thumb_key'),
    publicUrl: text('public_url'),
    thumbUrl: text('thumb_url'),
    mime: text('mime').notNull(),
    declaredSizeBytes: integer('declared_size_bytes').notNull(),
    actualSizeBytes: integer('actual_size_bytes'),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    durationSec: real('duration_sec'),
    blurhash: text('blurhash'),
    usedByType: text('used_by_type'),
    usedById: text('used_by_id'),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tw_media_owner_status_idx').on(t.ownerId, t.status)]
);

export const mediaJobsTable = pgTable('tw_media_jobs', {
  id: text('id').primaryKey(),
  mediaId: text('media_id')
    .notNull()
    .references(() => mediaTable.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const postsTable = pgTable(
  'tw_posts',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('text'),
    text: text('text').notNull().default(''),
    mediaId: text('media_id'),
    mediaJson: jsonb('media_json'),
    pollJson: jsonb('poll_json'),
    likesCount: integer('likes_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    repostsCount: integer('reposts_count').notNull().default(0),
    isLiked: boolean('is_liked').notNull().default(false),
    isSaved: boolean('is_saved').notNull().default(false),
    taggedProductsJson: jsonb('tagged_products_json'),
    createdAt: text('created_at').notNull(),
    location: text('location'),
    audioTrack: text('audio_track'),
    audience: text('audience').notNull().default('everyone'),
    isSponsored: boolean('is_sponsored').notNull().default(false),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    index('tw_posts_sort_ts_idx').on(t.sortTs),
    index('tw_posts_author_sort_ts_idx').on(t.authorId, t.sortTs),
  ]
);

export const commentsTable = pgTable(
  'tw_comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => postsTable.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
    likesCount: integer('likes_count').notNull().default(0),
    isLiked: boolean('is_liked').notNull().default(false),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    index('tw_comments_post_sort_ts_idx').on(t.postId, t.sortTs),
    index('tw_comments_author_idx').on(t.authorId),
  ]
);

export const storiesTable = pgTable(
  'tw_stories',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    mediaId: text('media_id'),
    mediaUrl: text('media_url').notNull(),
    mediaType: text('media_type').notNull().default('image'),
    caption: text('caption'),
    soundTitle: text('sound_title'),
    durationSec: integer('duration_sec').notNull().default(5),
    audience: text('audience').notNull().default('everyone'),
    mode: text('mode').notNull().default('story'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    expiresHint: text('expires_hint'),
    bgGradient: text('bg_gradient'),
    overlaysJson: jsonb('overlays_json'),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [index('tw_stories_author_sort_ts_idx').on(t.authorId, t.sortTs)]
);

export const storyViewsTable = pgTable(
  'tw_story_views',
  {
    storyId: text('story_id')
      .notNull()
      .references(() => storiesTable.id, { onDelete: 'cascade' }),
    viewerId: text('viewer_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })]
);

export const reactionsTable = pgTable(
  'tw_reactions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'post_like' | 'post_save' | 'comment_like' | 'product_wishlist' | 'poll_vote'
    targetId: text('target_id').notNull(),
    value: text('value').notNull().default('1'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    index('tw_reactions_target_idx').on(t.targetType, t.targetId),
  ]
);

export const socialMomentsTable = pgTable(
  'tw_social_moments',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(), // 'note' | 'instant'
    authorId: text('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    text: text('text'),
    mediaId: text('media_id'),
    mediaUrl: text('media_url'),
    mediaType: text('media_type'),
    soundId: text('sound_id'),
    audience: text('audience').notNull().default('everyone'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    index('tw_social_moments_author_sort_ts_idx').on(t.authorId, t.sortTs),
    index('tw_social_moments_sort_ts_idx').on(t.sortTs),
  ]
);

export const conversationsTable = pgTable('tw_conversations', {
  id: text('id').primaryKey(),
  directKey: text('direct_key').unique(),
  title: text('title').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  lastMessage: text('last_message').notNull().default(''),
  lastMessageTime: text('last_message_time').notNull(),
  unreadCount: integer('unread_count').notNull().default(0),
  isOnline: boolean('is_online').notNull().default(false),
  isPinned: boolean('is_pinned').notNull().default(false),
  isMuted: boolean('is_muted').notNull().default(false),
  isGroup: boolean('is_group').notNull().default(false),
  orderNumber: text('order_number'),
  sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
});

export const conversationMembersTable = pgTable(
  'tw_conversation_members',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    unreadCount: integer('unread_count').notNull().default(0),
    lastReadAt: timestamp('last_read_at'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]
);

export const messagesTable = pgTable(
  'tw_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),
    clientMsgId: text('client_msg_id'),
    mediaId: text('media_id'),
    mediaUrl: text('media_url'),
    text: text('text').notNull(),
    timestamp: text('timestamp').notNull(),
    isOwn: boolean('is_own').notNull().default(false),
    kind: text('kind').notNull().default('text'),
    status: text('status').notNull().default('sent'),
    voiceDuration: text('voice_duration'),
    reaction: text('reaction'),
    replyMarkupJson: jsonb('reply_markup_json'),
    replyToMessageId: text('reply_to_message_id'),
    editedAt: timestamp('edited_at'),
    deletedAt: timestamp('deleted_at'),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    uniqueIndex('tw_messages_conv_client_msg_uidx').on(t.conversationId, t.senderId, t.clientMsgId),
    index('tw_messages_conv_sort_ts_idx').on(t.conversationId, t.sortTs),
  ]
);

export const productsTable = pgTable(
  'tw_products',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id').references(() => usersTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    priceIqd: integer('price_iqd').notNull(),
    compareAtPriceIqd: integer('compare_at_price_iqd'),
    shopName: text('shop_name').notNull(),
    shopVerified: boolean('shop_verified').notNull().default(false),
    city: text('city').notNull(),
    province: text('province').notNull(),
    category: text('category').notNull().default('أخرى'),
    condition: text('condition').notNull().default('new'),
    imageUrl: text('image_url').notNull(),
    inStock: boolean('in_stock').notNull().default(true),
    ratingAvg: real('rating_avg').notNull().default(5),
    reviewCount: integer('review_count').notNull().default(0),
    isWishlisted: boolean('is_wishlisted').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('tw_products_seller_idx').on(t.sellerId),
    index('tw_products_sort_order_idx').on(t.sortOrder),
  ]
);

export const ordersTable = pgTable(
  'tw_orders',
  {
    id: text('id').primaryKey(),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sellerId: text('seller_id').references(() => usersTable.id, { onDelete: 'set null' }),
    productId: text('product_id')
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    priceIqd: integer('price_iqd').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'completed' | 'cancelled'
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('tw_orders_buyer_created_idx').on(t.buyerId, t.createdAt),
    index('tw_orders_seller_created_idx').on(t.sellerId, t.createdAt),
  ]
);

export const walletTransactionsTable = pgTable(
  'tw_wallet_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'topup' | 'gift_sent' | 'gift_received'
    amountCoins: integer('amount_coins').notNull(),
    description: text('description').notNull(),
    relatedUserId: text('related_user_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tw_wallet_tx_user_created_idx').on(t.userId, t.createdAt)]
);

export const communitiesTable = pgTable('tw_communities', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').references(() => usersTable.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  membersCount: integer('members_count').notNull().default(1),
  province: text('province').notNull(),
  category: text('category').notNull().default('عام'),
  isPrivate: boolean('is_private').notNull().default(false),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
});

export const communityMembersTable = pgTable(
  'tw_community_members',
  {
    communityId: text('community_id')
      .notNull()
      .references(() => communitiesTable.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })]
);

export const communityMessagesTable = pgTable(
  'tw_community_messages',
  {
    id: text('id').primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communitiesTable.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull().default('general'), // 'general' | 'announcements'
    text: text('text').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    sortTs: bigint('sort_ts', { mode: 'number' }).notNull().default(0),
  },
  (t) => [index('tw_community_messages_comm_sort_ts_idx').on(t.communityId, t.sortTs)]
);

export const savedCollectionsTable = pgTable('tw_saved_collections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedCollectionItemsTable = pgTable(
  'tw_saved_collection_items',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => savedCollectionsTable.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => postsTable.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.postId] })]
);

export const notificationsTable = pgTable(
  'tw_notifications',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id'),
    kind: text('kind').notNull(),
    targetText: text('target_text').notNull(),
    time: text('time').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    mediaThumbnailUrl: text('media_thumbnail_url'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('tw_notifications_recipient_sort_idx').on(t.recipientId, t.sortOrder)]
);

export const sessionsTable = pgTable(
  'tw_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceLabel: text('device_label').notNull().default('متصفح ويب'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastRotatedAt: timestamp('last_rotated_at').defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => [index('tw_sessions_user_idx').on(t.userId)]
);

export const otpChallengesTable = pgTable(
  'tw_otp_challenges',
  {
    id: text('id').primaryKey(),
    phoneHmac: text('phone_hmac').notNull(),
    purpose: text('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    invalidatedAt: timestamp('invalidated_at'),
    failedChallengeCounted: boolean('failed_challenge_counted').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tw_otp_phone_created_idx').on(t.phoneHmac, t.createdAt)]
);

export const reportsTable = pgTable('tw_reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  details: text('details').notNull().default(''),
  urgent: boolean('urgent').notNull().default(false),
  status: text('status').notNull().default('pending'), // 'pending' | 'banned' | 'dismissed'
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rateLimitsTable = pgTable('tw_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at').notNull(),
});

export const eventsTable = pgTable(
  'tw_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: text('recipient_user_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tw_events_recipient_idx').on(t.recipientUserId, t.id)]
);

export const botTokensTable = pgTable('tw_bot_tokens', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  secretHash: text('secret_hash').notNull(),
  prefix: text('prefix').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const botCommandsTable = pgTable('tw_bot_commands', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  command: text('command').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const botWebhooksTable = pgTable('tw_bot_webhooks', {
  botId: text('bot_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secretTokenHash: text('secret_token_hash'),
  secretTokenEnc: text('secret_token_enc'),
  allowedUpdatesJson: jsonb('allowed_updates_json'),
  failureCount: integer('failure_count').notNull().default(0),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at'),
  disabledAt: timestamp('disabled_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const botUpdatesTable = pgTable(
  'tw_bot_updates',
  {
    updateId: bigint('update_id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    botId: text('bot_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    payloadJson: jsonb('payload_json').notNull(),
    ackedAt: timestamp('acked_at'),
    deliveredAt: timestamp('delivered_at'),
    nextRetryAt: timestamp('next_retry_at'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tw_bot_updates_bot_idx').on(t.botId, t.updateId)]
);

export const botChatStateTable = pgTable(
  'tw_bot_chat_state',
  {
    botId: text('bot_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id'),
    startedAt: timestamp('started_at'),
    blockedAt: timestamp('blocked_at'),
    wizardStateJson: jsonb('wizard_state_json'),
  },
  (t) => [primaryKey({ columns: [t.botId, t.userId] })]
);
