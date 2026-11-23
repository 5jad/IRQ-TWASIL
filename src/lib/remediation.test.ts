import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommentTree,
  canSendDirectMessage,
  filterNotificationsByTab,
  filterProducts,
  resolveConversationPeer,
  resolveStoryCanvasFormat,
} from './remediation.ts';
import type { AppNotification, PostComment, Product, User } from '../types/index.ts';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    username: 'user1',
    displayName: 'مستخدم تجريبي',
    avatarUrl: '',
    bio: '',
    province: 'بغداد',
    isVerified: false,
    verifiedKind: 'none',
    accountType: 'personal',
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    ...overrides,
  };
}

test('resolveStoryCanvasFormat preserves GIF animation, PNG alpha, and JPEG fallback', () => {
  const gif = resolveStoryCanvasFormat('image/gif');
  assert.equal(gif.skipCanvasRasterize, true);
  assert.equal(gif.exportMime, 'image/gif');
  assert.equal(gif.ext, 'gif');
  assert.equal(gif.preserveAlpha, true);

  const png = resolveStoryCanvasFormat('image/png; charset=utf-8');
  assert.equal(png.skipCanvasRasterize, false);
  assert.equal(png.exportMime, 'image/png');
  assert.equal(png.ext, 'png');
  assert.equal(png.preserveAlpha, true);

  const webpAlpha = resolveStoryCanvasFormat('image/webp', true);
  assert.equal(webpAlpha.exportMime, 'image/png');
  assert.equal(webpAlpha.preserveAlpha, true);

  const jpg = resolveStoryCanvasFormat('image/jpeg', false);
  assert.equal(jpg.skipCanvasRasterize, false);
  assert.equal(jpg.exportMime, 'image/jpeg');
  assert.equal(jpg.ext, 'jpg');
  assert.equal(jpg.preserveAlpha, false);
});

test('filterNotificationsByTab accurately separates all, likes, orders, and system notifications', () => {
  const actor = makeUser();
  const sample: AppNotification[] = [
    { id: '1', actor, kind: 'like', targetText: 'أعجب بمنشورك', time: 'الآن', isRead: false },
    { id: '2', actor, kind: 'comment', targetText: 'علّق على منشورك', time: 'الآن', isRead: false },
    { id: '3', actor, kind: 'follow', targetText: 'بدأ بمتابعتك', time: 'الآن', isRead: true },
    { id: '4', actor, kind: 'order', targetText: 'طلب جديد', time: 'الآن', isRead: false },
    { id: '5', actor, kind: 'system', targetText: 'تنبيه نظام', time: 'الآن', isRead: true },
  ];

  assert.equal(filterNotificationsByTab(sample, 'all').length, 5);
  assert.deepEqual(
    filterNotificationsByTab(sample, 'likes').map((n) => n.id),
    ['1', '2', '3']
  );
  assert.deepEqual(
    filterNotificationsByTab(sample, 'orders').map((n) => n.id),
    ['4']
  );
  assert.deepEqual(
    filterNotificationsByTab(sample, 'system').map((n) => n.id),
    ['5']
  );
});

test('buildCommentTree nests replies under parents and prevents self-parent or orphan loss', () => {
  const author = makeUser();
  const flat: PostComment[] = [
    { id: 'c1', author, text: 'أول تعليق', createdAt: '2026-01-01T00:00:00Z', likesCount: 2 },
    { id: 'c2', parentId: 'c1', author, text: 'رد على الأول', createdAt: '2026-01-01T00:01:00Z', likesCount: 1 },
    { id: 'c3', parentId: 'c2', author, text: 'رد متداخل', createdAt: '2026-01-01T00:02:00Z', likesCount: 0 },
    { id: 'c4', parentId: 'c4', author, text: 'حماية حلقة ذاتية', createdAt: '2026-01-01T00:03:00Z', likesCount: 0 },
    { id: 'c5', parentId: 'missing', author, text: 'تعليق يتيم', createdAt: '2026-01-01T00:04:00Z', likesCount: 0 },
  ];

  const tree = buildCommentTree(flat);
  assert.deepEqual(
    tree.map((c) => c.id),
    ['c1', 'c4', 'c5']
  );
  assert.equal(tree[0]?.replies?.length, 1);
  assert.equal(tree[0]?.replies?.[0]?.id, 'c2');
  assert.equal(tree[0]?.replies?.[0]?.replies?.[0]?.id, 'c3');
});

test('resolveConversationPeer isolates mutual 1:1 peers and respects online visibility & 5m window', () => {
  const userA = makeUser({ id: 'u-a', displayName: 'أحمد' });
  const userB = makeUser({ id: 'u-b', displayName: 'سجاد' });
  const bot = makeUser({ id: 'bot-1', displayName: 'مصنع البوتات', kind: 'bot' });
  const now = 1_700_000_000_000;

  // Viewer A sees Peer B; Viewer B sees Peer A
  const peerForA = resolveConversationPeer({
    viewerId: 'u-a',
    isGroup: false,
    memberUsers: [userA, userB],
    storedTitle: 'Old stored title',
    storedAvatarUrl: '',
    storedIsOnline: true,
    lastSeenMsByUserId: { 'u-b': now - 60_000 },
    onlineVisibilityByUserId: { 'u-b': true },
    nowMs: now,
  });
  assert.equal(peerForA.peerId, 'u-b');
  assert.equal(peerForA.title, 'سجاد');
  assert.equal(peerForA.isOnline, true);

  const peerForB = resolveConversationPeer({
    viewerId: 'u-b',
    isGroup: false,
    memberUsers: [userA, userB],
    storedTitle: 'Old stored title',
    storedAvatarUrl: '',
    storedIsOnline: true,
    lastSeenMsByUserId: { 'u-a': now - 10 * 60_000 },
    onlineVisibilityByUserId: { 'u-a': true },
    nowMs: now,
  });
  assert.equal(peerForB.peerId, 'u-a');
  assert.equal(peerForB.title, 'أحمد');
  assert.equal(peerForB.isOnline, false);

  // Privacy flag hides online indicator even within 5-minute window
  const hiddenPeer = resolveConversationPeer({
    viewerId: 'u-a',
    isGroup: false,
    memberUsers: [userA, userB],
    storedTitle: '',
    storedAvatarUrl: '',
    storedIsOnline: true,
    lastSeenMsByUserId: { 'u-b': now - 5_000 },
    onlineVisibilityByUserId: { 'u-b': false },
    nowMs: now,
  });
  assert.equal(hiddenPeer.isOnline, false);

  // Bot is always flagged online & botId populated
  const botPeer = resolveConversationPeer({
    viewerId: 'u-a',
    isGroup: false,
    memberUsers: [userA, bot],
    storedTitle: '',
    storedAvatarUrl: '',
    storedIsOnline: false,
    nowMs: now,
  });
  assert.equal(botPeer.isBot, true);
  assert.equal(botPeer.botId, 'bot-1');
  assert.equal(botPeer.isOnline, true);
});

test('canSendDirectMessage enforces everyone, followers, nobody, and bot bypass', () => {
  assert.equal(canSendDirectMessage({ dmPermission: 'everyone', senderFollowsRecipient: false }), true);
  assert.equal(canSendDirectMessage({ dmPermission: 'followers', senderFollowsRecipient: false }), false);
  assert.equal(canSendDirectMessage({ dmPermission: 'followers', senderFollowsRecipient: true }), true);
  assert.equal(canSendDirectMessage({ dmPermission: 'nobody', senderFollowsRecipient: true }), false);
  assert.equal(canSendDirectMessage({ dmPermission: 'nobody', senderFollowsRecipient: false, isBot: true }), true);
});

test('filterProducts normalizes Arabic hamza/taa-marbuta/alef-maqsura and filters categories', () => {
  const items: Product[] = [
    {
      id: 'p1',
      title: 'أباريق نحاسية تراثية',
      priceIqd: 25000,
      shopName: 'سوق الصفافير',
      shopVerified: true,
      city: 'بغداد',
      province: 'بغداد',
      category: 'نحاسيات وفضيات',
      condition: 'new',
      imageUrl: '',
      inStock: true,
      ratingAvg: 4.9,
      reviewCount: 10,
    },
    {
      id: 'p2',
      title: 'مسبحة كهرب طبيعية',
      priceIqd: 90000,
      shopName: 'خان مرجان',
      shopVerified: false,
      city: 'النجف',
      province: 'النجف الأشرف',
      category: 'أحجار ومسابح',
      condition: 'used',
      imageUrl: '',
      inStock: true,
      ratingAvg: 4.7,
      reviewCount: 4,
    },
  ];

  // Query with ا instead of أ and ه instead of ة
  const byNormQuery = filterProducts(items, 'اباريق نحاسيه', 'الكل');
  assert.deepEqual(byNormQuery.map((p) => p.id), ['p1']);

  const byCategory = filterProducts(items, '', 'أحجار ومسابح');
  assert.deepEqual(byCategory.map((p) => p.id), ['p2']);
});
