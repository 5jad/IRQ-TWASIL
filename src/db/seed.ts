import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, hasDatabaseConfig } from './index.ts';
import {
  usersTable,
  followsTable,
  closeFriendsTable,
  postsTable,
  commentsTable,
  storiesTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
  productsTable,
  communitiesTable,
  notificationsTable,
  botCommandsTable,
} from './schema.ts';
import {
  SEED_USERS,
  SEED_POSTS,
  SEED_CONVERSATIONS,
  SEED_MESSAGES_BY_CONVERSATION,
  SEED_PRODUCTS,
  SEED_NOTIFICATIONS,
  SEED_INSTANTS,
  SEED_STORIES,
} from '../lib/seedData.ts';

export const BOTFACTORY_ID = 'bot-botfactory';
export const BOTFACTORY_HANDLE = 'botfactory_bot';

const DEFAULT_COMMUNITIES = [
  {
    id: 'c-1',
    name: 'مجتمع مطوري ومصممي العراق 💻',
    membersCount: 4280,
    province: 'بغداد',
    description: 'ملتقى المبرمجين، مهندسي البرمجيات ومصممي تجربة المستخدم من كافة محافظات العراق.',
    icon: '/seed/comm-1.svg',
  },
  {
    id: 'c-2',
    name: 'نادي تراث وعمارة الرافدين 🏛️',
    membersCount: 2950,
    province: 'البصرة',
    description: 'توثيق الشناشيل، الآثار البابلية والآشورية والبيوت التراثية البغدادية.',
    icon: '/seed/comm-2.svg',
  },
  {
    id: 'c-3',
    name: 'رابطة تجار وأصحاب الحرف اليدوية ⚒️',
    membersCount: 1840,
    province: 'النجف الأشرف',
    description: 'تبادل الخبرات في صناعة النحاس، الفضة، السجاد، ودعم التجارة المحلية.',
    icon: '/seed/comm-3.svg',
  },
];

let seedPromise: Promise<void> | null = null;
let systemBotsPromise: Promise<void> | null = null;
let legacyNotifBackfillPromise: Promise<void> | null = null;

async function backfillLegacyNotifications(): Promise<void> {
  if (!hasDatabaseConfig()) return;
  if (!legacyNotifBackfillPromise) {
    legacyNotifBackfillPromise = (async () => {
      const db = getDb();
      const [me] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, 'u-me'))
        .limit(1);
      if (!me) return;
      await db
        .update(notificationsTable)
        .set({ recipientId: 'u-me' })
        .where(
          and(
            isNull(notificationsTable.recipientId),
            inArray(notificationsTable.id, ['notif-1', 'notif-2', 'notif-3', 'notif-4'])
          )
        );
    })().catch((err) => {
      legacyNotifBackfillPromise = null;
      throw err;
    });
  }
  return legacyNotifBackfillPromise;
}

export async function ensureSystemBots(): Promise<void> {
  if (!hasDatabaseConfig()) return;
  if (!systemBotsPromise) {
    systemBotsPromise = (async () => {
      const db = getDb();
      await db
        .insert(usersTable)
        .values({
          id: BOTFACTORY_ID,
          username: BOTFACTORY_HANDLE,
          handle: BOTFACTORY_HANDLE,
          displayName: 'مصنع البوتات',
          avatarUrl: '/seed/comm-1.svg',
          bio: 'البوت الرسمي لإنشاء وإدارة بوتات تواصل العراقية.',
          province: 'بغداد',
          isVerified: true,
          verifiedKind: 'official',
          accountType: 'creator',
          role: 'user',
          kind: 'bot',
          status: 'active',
          botDescription: 'أنشئ بوتاتك الخاصة على منصة تواصل، استخرج مفاتيح الربط البرمجي، وأدر الأوامر والويب هوك بسهولة.',
          botShortDescription: 'البوت الرسمي لإنشاء وإدارة البوتات في تواصل',
          botPrivacyMode: false,
          botCanJoinGroups: false,
          botIsListed: true,
          sortOrder: 900,
        })
        .onConflictDoNothing();

      const factoryCommands = [
        { command: 'newbot', description: 'إنشاء بوت جديد خطوة بخطوة' },
        { command: 'mybots', description: 'عرض قائمة البوتات الخاصة بك' },
        { command: 'token', description: 'توليد أو تجديد رمز الوصول البرمجي' },
        { command: 'setname', description: 'تغيير اسم البوت المعروض' },
        { command: 'setdescription', description: 'تحديث الوصف التفصيلي للبوت' },
        { command: 'setabouttext', description: 'تحديث النبذة المختصرة للبوت' },
        { command: 'setuserpic', description: 'تحديث صورة البوت عبر media_id' },
        { command: 'setcommands', description: 'تعيين قائمة أوامر البوت' },
        { command: 'setprivacy', description: 'تبديل وضع الخصوصية في المجموعات' },
        { command: 'deletebot', description: 'حذف أحد البوتات نهائياً' },
      ];

      for (let i = 0; i < factoryCommands.length; i++) {
        const c = factoryCommands[i]!;
        await db
          .insert(botCommandsTable)
          .values({
            id: `cmd-factory-${c.command}`,
            botId: BOTFACTORY_ID,
            command: c.command,
            description: c.description,
            sortOrder: i,
          })
          .onConflictDoNothing();
      }
    })().catch((err) => {
      systemBotsPromise = null;
      throw err;
    });
  }
  return systemBotsPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  await ensureSystemBots();

  const db = getDb();
  const existingUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.kind, 'person'))
    .limit(1);

  if (existingUsers.length > 0) {
    const existingInstants = await db
      .select({ id: storiesTable.id })
      .from(storiesTable)
      .where(eq(storiesTable.mode, 'instants'))
      .limit(1);
    if (existingInstants.length === 0) {
      await db
        .insert(storiesTable)
        .values(
          SEED_INSTANTS.map((s) => ({
            id: s.id,
            authorId: s.authorId,
            mediaUrl: s.mediaUrl,
            mediaType: s.mediaType,
            caption: s.caption ?? null,
            soundTitle: s.soundTitle ?? null,
            durationSec: s.durationSec,
            audience: s.audience,
            mode: s.mode,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            expiresHint: s.expiresHint ?? null,
            bgGradient: s.bgGradient ?? null,
            overlaysJson: s.overlays ?? null,
            sortTs: Date.parse(s.createdAt) || Date.now(),
          }))
        )
        .onConflictDoNothing();
    }
    const firstSeedStoryId = SEED_STORIES[0]?.id;
    const existingSeedStory = firstSeedStoryId
      ? await db
          .select({ id: storiesTable.id })
          .from(storiesTable)
          .where(eq(storiesTable.id, firstSeedStoryId))
          .limit(1)
      : [];
    if (existingSeedStory.length === 0 && SEED_STORIES.length > 0) {
      await db
        .insert(storiesTable)
        .values(
          SEED_STORIES.map((s) => ({
            id: s.id,
            authorId: s.authorId,
            mediaUrl: s.mediaUrl,
            mediaType: s.mediaType,
            caption: s.caption ?? null,
            soundTitle: s.soundTitle ?? null,
            durationSec: s.durationSec,
            audience: s.audience,
            mode: s.mode,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            expiresHint: s.expiresHint ?? null,
            bgGradient: s.bgGradient ?? null,
            overlaysJson: {
              items: s.overlays ?? [],
              soundId: s.soundId,
              videoVolume: s.videoVolume,
              musicVolume: s.musicVolume,
              soundStartSec: s.soundStartSec,
              kind: s.kind ?? 'story',
            },
            sortTs: Date.parse(s.createdAt) || Date.now(),
          }))
        )
        .onConflictDoNothing();
    }
    return;
  }

  await db
    .insert(usersTable)
    .values(
      SEED_USERS.map((u, idx) => ({
        id: u.id,
        username: u.username,
        handle: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        coverUrl: u.coverUrl ?? null,
        bio: u.bio,
        province: u.province,
        city: u.city ?? null,
        isVerified: u.isVerified,
        verifiedKind: u.verifiedKind,
        accountType: u.accountType,
        role: u.role ?? 'user',
        kind: 'person',
        status: 'active',
        followersCount: u.followersCount,
        followingCount: u.followingCount,
        postsCount: u.postsCount,
        hasActiveStory: Boolean(u.hasActiveStory),
        sortOrder: idx,
      }))
    )
    .onConflictDoNothing();

  // Seed follows and close friends relationships for u-me
  const followValues = SEED_USERS.filter((u) => u.id !== 'u-me' && u.isFollowing).map((u) => ({
    followerId: 'u-me',
    followeeId: u.id,
  }));
  if (followValues.length > 0) {
    await db.insert(followsTable).values(followValues).onConflictDoNothing();
  }

  const closeFriendValues = SEED_USERS.filter((u) => u.id !== 'u-me' && u.isCloseFriend).map((u) => ({
    ownerId: 'u-me',
    friendId: u.id,
  }));
  if (closeFriendValues.length > 0) {
    await db.insert(closeFriendsTable).values(closeFriendValues).onConflictDoNothing();
  }

  const baseNow = Date.now();

  await db
    .insert(postsTable)
    .values(
      SEED_POSTS.map((p, idx) => ({
        id: p.id,
        authorId: p.author.id,
        kind: p.kind,
        text: p.text,
        mediaJson: p.media ?? null,
        pollJson: p.poll ?? null,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        repostsCount: p.repostsCount,
        isLiked: Boolean(p.isLiked),
        isSaved: Boolean(p.isSaved),
        taggedProductsJson: p.taggedProducts ?? null,
        createdAt: p.createdAt,
        location: p.location ?? null,
        audioTrack: p.audioTrack ?? null,
        isSponsored: Boolean(p.isSponsored),
        sortTs: Date.parse(p.createdAt) || baseNow - idx * 60_000,
      }))
    )
    .onConflictDoNothing();

  const seedComments = SEED_POSTS.flatMap((post) =>
    (post.comments ?? []).map((c, idx) => ({
      id: c.id,
      postId: post.id,
      authorId: c.author.id,
      text: c.text,
      createdAt: c.createdAt,
      likesCount: c.likesCount,
      isLiked: Boolean(c.isLiked),
      sortTs: Date.parse(c.createdAt) || baseNow - idx * 1000,
    }))
  );

  if (seedComments.length > 0) {
    await db.insert(commentsTable).values(seedComments).onConflictDoNothing();
  }

  await db
    .insert(conversationsTable)
    .values(
      SEED_CONVERSATIONS.map((c, idx) => ({
        id: c.id,
        title: c.title,
        avatarUrl: c.avatarUrl,
        lastMessage: c.lastMessage,
        lastMessageTime: c.lastMessageTime,
        unreadCount: c.unreadCount,
        isOnline: Boolean(c.isOnline),
        isPinned: Boolean(c.isPinned),
        isMuted: Boolean(c.isMuted),
        isGroup: Boolean(c.isGroup),
        orderNumber: c.orderNumber ?? null,
        sortTs: Date.parse(c.lastMessageTime) || baseNow - idx * 60_000,
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(conversationMembersTable)
    .values(
      SEED_CONVERSATIONS.map((c) => ({
        conversationId: c.id,
        userId: 'u-me',
        role: 'member',
        unreadCount: c.unreadCount,
      }))
    )
    .onConflictDoNothing();

  const seedMessages = Object.entries(SEED_MESSAGES_BY_CONVERSATION).flatMap(
    ([convId, msgs]) =>
      msgs.map((m, idx) => ({
        id: m.id,
        conversationId: convId,
        senderId: m.senderId,
        text: m.text,
        timestamp: m.timestamp,
        isOwn: m.isOwn,
        kind: m.kind,
        status: m.status,
        voiceDuration: m.voiceDuration ?? null,
        reaction: m.reaction ?? null,
        sortTs: baseNow - 86_400_000 + idx * 1000,
      }))
  );

  if (seedMessages.length > 0) {
    await db.insert(messagesTable).values(seedMessages).onConflictDoNothing();
  }

  await db
    .insert(productsTable)
    .values(
      SEED_PRODUCTS.map((p, idx) => ({
        id: p.id,
        title: p.title,
        priceIqd: p.priceIqd,
        compareAtPriceIqd: p.compareAtPriceIqd ?? null,
        shopName: p.shopName,
        shopVerified: p.shopVerified,
        city: p.city,
        province: p.province,
        condition: p.condition,
        imageUrl: p.imageUrl,
        inStock: p.inStock,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        isWishlisted: Boolean(p.isWishlisted),
        sortOrder: idx,
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(communitiesTable)
    .values(
      DEFAULT_COMMUNITIES.map((c, idx) => ({
        ...c,
        sortTs: baseNow - idx * 1000,
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(notificationsTable)
    .values(
      SEED_NOTIFICATIONS.map((n, idx) => ({
        id: n.id,
        actorId: n.actor.id,
        recipientId: 'u-me',
        kind: n.kind,
        targetText: n.targetText,
        time: n.time,
        isRead: n.isRead,
        mediaThumbnailUrl: n.mediaThumbnailUrl ?? null,
        sortOrder: idx,
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(storiesTable)
    .values(
      [...SEED_STORIES, ...SEED_INSTANTS].map((s) => ({
        id: s.id,
        authorId: s.authorId,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        caption: s.caption ?? null,
        soundTitle: s.soundTitle ?? null,
        durationSec: s.durationSec,
        audience: s.audience,
        mode: s.mode,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        expiresHint: s.expiresHint ?? null,
        bgGradient: s.bgGradient ?? null,
        overlaysJson: {
          items: s.overlays ?? [],
          soundId: s.soundId,
          videoVolume: s.videoVolume,
          musicVolume: s.musicVolume,
          soundStartSec: s.soundStartSec,
          kind: s.kind ?? (s.mode === 'instants' ? 'instant' : 'story'),
        },
        sortTs: Date.parse(s.createdAt) || baseNow,
      }))
    )
    .onConflictDoNothing();
}

export async function ensureSeeded(): Promise<void> {
  await ensureSystemBots();
}
