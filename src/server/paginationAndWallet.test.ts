import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { eq, inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  commentsTable,
  otpChallengesTable,
  postsTable,
  rateLimitsTable,
  usersTable,
  walletTransactionsTable,
} from '../db/schema.ts';
import { hmacPhone } from './phone.ts';
import { setTestOtpListener } from './otp.ts';

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] ?? '' : '';
}

test('pagination, on-demand comments, single post, Arabic search, and admin-only wallet topup', async (t) => {
  if (!hasDatabaseConfig()) {
    t.skip('DATABASE_URL not configured');
    return;
  }

  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  resetEnvCache();

  const app = await createAppServer();
  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const createdUserIds: string[] = [];
  const createdPhoneHmacs: string[] = [];
  const createdPostIds: string[] = [];

  try {
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;
    const db = getDb();
    await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, 'rl:otp_%'));
    await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, 'rl:signup:%'));

    let capturedCode = '';
    setTestOtpListener((_phone, code) => {
      capturedCode = code;
    });

    async function createUser(prefix: string, phone: string, displayName: string) {
      createdPhoneHmacs.push(hmacPhone(phone));
      const reqRes = await fetch(`${base}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ phone, purpose: 'signup' }),
      });
      assert.equal(reqRes.status, 200);
      const { challengeId } = (await reqRes.json()) as { challengeId: string };

      const verRes = await fetch(`${base}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ challengeId, code: capturedCode }),
      });
      assert.equal(verRes.status, 200);
      const { signupToken } = (await verRes.json()) as { signupToken: string };

      const sRes = await fetch(`${base}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({
          signupToken,
          handle: `${prefix}_${crypto.randomBytes(3).toString('hex')}`,
          displayName,
          province: 'بغداد',
          birthYear: 1995,
          accountType: 'personal',
          acceptedTerms: true,
        }),
      });
      assert.equal(sRes.status, 201);
      const cookie = extractCookie(sRes);
      const { user } = (await sRes.json()) as { user: { id: string } };
      createdUserIds.push(user.id);
      return { userId: user.id, cookie };
    }

    const r1 = String(crypto.randomInt(1000000, 9999999));
    const r2 = String(crypto.randomInt(1000000, 9999999));
    const regularUser = await createUser('reg', `+964771${r1}`, 'إبراهيم البغدادي');
    const adminUser = await createUser('adm', `+964781${r2}`, 'إدارة المنصة');

    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.id, adminUser.userId));

    // Create 4 posts with distinct sortTs via staggered creation
    for (let i = 0; i < 4; i++) {
      const pid = `post-pg-${i}-${crypto.randomBytes(3).toString('hex')}`;
      createdPostIds.push(pid);
      const res = await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: regularUser.cookie },
        body: JSON.stringify({
          id: pid,
          text: `منشور أربيل السياحية رقم ${i} للتحقق من الترقيم والبحث`,
        }),
      });
      assert.equal(res.status, 201);
      await db
        .update(postsTable)
        .set({ sortTs: Date.now() + (i + 1) * 1000 })
        .where(eq(postsTable.id, pid));
    }

    // Add nested comments on the first created post
    const targetPostId = createdPostIds[0]!;
    const rootCommentRes = await fetch(`${base}/api/posts/${encodeURIComponent(targetPostId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: regularUser.cookie },
      body: JSON.stringify({ text: 'تعليق رئيسي للاختبار' }),
    });
    assert.equal(rootCommentRes.status, 201);
    const rootComment = (await rootCommentRes.json()) as { id: string };

    const replyCommentRes = await fetch(`${base}/api/posts/${encodeURIComponent(targetPostId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: adminUser.cookie },
      body: JSON.stringify({ parentId: rootComment.id, text: 'رد متداخل على التعليق' }),
    });
    assert.equal(replyCommentRes.status, 201);

    // 1. Bootstrap returns <= 20 posts without inline comments arrays
    const bootRes = await fetch(`${base}/api/bootstrap`, {
      headers: { Cookie: regularUser.cookie },
    });
    assert.equal(bootRes.status, 200);
    const bootJson = (await bootRes.json()) as {
      posts: Array<{ id: string; comments?: unknown[] }>;
      postsNextCursor?: string | null;
      postsHasMore?: boolean;
    };
    assert.ok(bootJson.posts.length <= 20);
    assert.ok(bootJson.posts.length >= 4);
    for (const p of bootJson.posts) {
      assert.equal(p.comments, undefined);
    }

    // 2. Cursor pagination across pages has zero duplicates
    const page1Res = await fetch(`${base}/api/posts?limit=2`, {
      headers: { Cookie: regularUser.cookie },
    });
    assert.equal(page1Res.status, 200);
    const page1 = (await page1Res.json()) as {
      posts: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    };
    assert.equal(page1.posts.length, 2);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor);

    const page2Res = await fetch(
      `${base}/api/posts?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      { headers: { Cookie: regularUser.cookie } }
    );
    assert.equal(page2Res.status, 200);
    const page2 = (await page2Res.json()) as {
      posts: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    };
    assert.equal(page2.posts.length, 2);

    const page1Ids = new Set(page1.posts.map((p) => p.id));
    for (const p of page2.posts) {
      assert.equal(page1Ids.has(p.id), false, 'Duplicate post returned across cursor pages');
    }

    // 3. On-demand comments & single post endpoints
    const commentsRes = await fetch(`${base}/api/posts/${encodeURIComponent(targetPostId)}/comments`, {
      headers: { Cookie: regularUser.cookie },
    });
    assert.equal(commentsRes.status, 200);
    const commentsJson = (await commentsRes.json()) as {
      totalCount: number;
      comments: Array<{ id: string; replies?: Array<{ id: string; text: string }> }>;
    };
    assert.equal(commentsJson.totalCount, 2);
    assert.equal(commentsJson.comments.length, 1);
    assert.equal(commentsJson.comments[0]?.replies?.length, 1);

    const singlePostRes = await fetch(`${base}/api/posts/${encodeURIComponent(targetPostId)}`, {
      headers: { Cookie: regularUser.cookie },
    });
    assert.equal(singlePostRes.status, 200);
    const singlePostJson = (await singlePostRes.json()) as { post: { id: string } };
    assert.equal(singlePostJson.post.id, targetPostId);

    const missingPostRes = await fetch(`${base}/api/posts/nonexistent-post-id`);
    assert.equal(missingPostRes.status, 404);

    // 4. Unified Arabic search normalizes أ/إ -> ا, ة -> ه, and diacritics
    const searchRes = await fetch(
      `${base}/api/search?q=${encodeURIComponent('اَرْبِيل السياحيه')}`,
      { headers: { Cookie: regularUser.cookie } }
    );
    assert.equal(searchRes.status, 200);
    const searchJson = (await searchRes.json()) as {
      posts: Array<{ id: string }>;
      users: Array<{ id: string }>;
    };
    assert.ok(searchJson.posts.some((p) => createdPostIds.includes(p.id)));

    const userSearchRes = await fetch(
      `${base}/api/search?q=${encodeURIComponent('ابراهيم')}&type=users`,
      { headers: { Cookie: adminUser.cookie } }
    );
    assert.equal(userSearchRes.status, 200);
    const userSearchJson = (await userSearchRes.json()) as { users: Array<{ id: string }> };
    assert.ok(userSearchJson.users.some((u) => u.id === regularUser.userId));

    // 5. Wallet topup strictly gated to admin only
    const userTopupRes = await fetch(`${base}/api/wallet/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: regularUser.cookie },
      body: JSON.stringify({ amountCoins: 500 }),
    });
    assert.equal(userTopupRes.status, 403);
    const userTopupJson = (await userTopupRes.json()) as { error: string };
    assert.equal(userTopupJson.error, 'forbidden');

    const adminTopupRes = await fetch(`${base}/api/wallet/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: adminUser.cookie },
      body: JSON.stringify({ amountCoins: 750, targetUserId: regularUser.userId }),
    });
    assert.equal(adminTopupRes.status, 201);
    const adminTopupJson = (await adminTopupRes.json()) as {
      walletBalance: number;
      transaction: { amountCoins: number };
    };
    assert.equal(adminTopupJson.walletBalance, 750);
    assert.equal(adminTopupJson.transaction.amountCoins, 750);
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      for (const uid of createdUserIds) {
        await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, `%${uid}%`));
      }
      if (createdUserIds.length > 0) {
        await db
          .delete(walletTransactionsTable)
          .where(inArray(walletTransactionsTable.userId, createdUserIds));
      }
      if (createdPostIds.length > 0) {
        await db.delete(commentsTable).where(inArray(commentsTable.postId, createdPostIds));
        await db.delete(postsTable).where(inArray(postsTable.id, createdPostIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
      }
      if (createdPhoneHmacs.length > 0) {
        await db
          .delete(otpChallengesTable)
          .where(inArray(otpChallengesTable.phoneHmac, createdPhoneHmacs));
      }
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDbPool();
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    resetEnvCache();
  }
});
