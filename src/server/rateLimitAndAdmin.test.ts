import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { eq, inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  blocksTable,
  otpChallengesTable,
  postsTable,
  rateLimitsTable,
  reportsTable,
  usersTable,
} from '../db/schema.ts';
import { hmacPhone } from './phone.ts';
import { setTestOtpListener } from './otp.ts';
import { isNewAccount } from './rateLimit.ts';

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] ?? '' : '';
}

test('isNewAccount detects accounts created under 24 hours ago', () => {
  const freshReq = {
    auth: { userRow: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
  } as unknown as Parameters<typeof isNewAccount>[0];
  const oldReq = {
    auth: { userRow: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
  } as unknown as Parameters<typeof isNewAccount>[0];
  assert.equal(isNewAccount(freshReq), true);
  assert.equal(isNewAccount(oldReq), false);
});

test('rate limits (<24h half limit, 429 + Retry-After), duplicate spam, and reports/admin resolution', async (t) => {
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
  const createdReportIds: string[] = [];

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

    async function createUser(prefix: string, phone: string) {
      createdPhoneHmacs.push(hmacPhone(phone));
      const reqRes = await fetch(`${base}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ phone, purpose: 'signup' }),
      });
      const { challengeId } = (await reqRes.json()) as { challengeId: string };
      const verRes = await fetch(`${base}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ challengeId, code: capturedCode }),
      });
      const { signupToken } = (await verRes.json()) as { signupToken: string };
      const sRes = await fetch(`${base}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({
          signupToken,
          handle: `${prefix}_${crypto.randomBytes(3).toString('hex')}`,
          displayName: 'مستخدم اختبار',
          province: 'بغداد',
          birthYear: 1995,
          accountType: 'personal',
          acceptedTerms: true,
        }),
      });
      const cookie = extractCookie(sRes);
      const { user } = (await sRes.json()) as { user: { id: string } };
      createdUserIds.push(user.id);
      return { userId: user.id, cookie };
    }

    const r1 = String(crypto.randomInt(1000000, 9999999));
    const r2 = String(crypto.randomInt(1000000, 9999999));
    const r3 = String(crypto.randomInt(1000000, 9999999));
    const reporter = await createUser('rep', `+964770${r1}`);
    const spammer = await createUser('spam', `+964780${r2}`);
    const adminUser = await createUser('adm', `+964750${r3}`);

    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.id, adminUser.userId));

    // 1. Duplicate content check: 3rd identical normalized text within 10 minutes -> 429 duplicate_spam
    for (let i = 0; i < 2; i++) {
      const pid = `post-dup-${i}-${crypto.randomBytes(3).toString('hex')}`;
      createdPostIds.push(pid);
      const res = await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: spammer.cookie },
        body: JSON.stringify({ id: pid, text: '  نفس   النص المكرر تماما  ' }),
      });
      assert.equal(res.status, 201);
    }
    const dupRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: spammer.cookie },
      body: JSON.stringify({ text: 'نفس النص المكرر تماما' }),
    });
    assert.equal(dupRes.status, 429);
    const dupJson = (await dupRes.json()) as { error: string; retryAfterSec?: number };
    assert.equal(dupJson.error, 'duplicate_spam');
    assert.ok((dupJson.retryAfterSec ?? 0) >= 1);

    // 2. New account (<24h) hits halved contentWriteLimiter (limit 15 instead of 30)
    // Spammer already made 3 requests through contentWriteLimiter (2 good + 1 duplicate), so send 12 more (total 15), 16th hits 429 rate_limited
    for (let i = 0; i < 12; i++) {
      const pid = `post-rl-${i}-${crypto.randomBytes(3).toString('hex')}`;
      createdPostIds.push(pid);
      const r = await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: spammer.cookie },
        body: JSON.stringify({ id: pid, text: `منشور فريد رقم ${i} للتجربة` }),
      });
      assert.equal(r.status, 201);
    }
    const rlRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: spammer.cookie },
      body: JSON.stringify({ text: 'منشور سادس عشر يتجاوز الحد' }),
    });
    assert.equal(rlRes.status, 429);
    assert.ok(Number(rlRes.headers.get('retry-after')) >= 1);
    const rlJson = (await rlRes.json()) as { error: string };
    assert.equal(rlJson.error, 'rate_limited');

    // 3. Report with urgent reason + alsoBlock
    const targetPostId = createdPostIds[0]!;
    const repRes = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: reporter.cookie },
      body: JSON.stringify({
        targetType: 'post',
        targetId: targetPostId,
        reason: 'extortion',
        details: 'ابتزاز واضح',
        alsoBlock: true,
      }),
    });
    assert.equal(repRes.status, 201);
    const repJson = (await repRes.json()) as { id: string; urgent: boolean; status: string };
    createdReportIds.push(repJson.id);
    assert.equal(repJson.urgent, true);
    assert.equal(repJson.status, 'pending');

    const [blockRow] = await db
      .select()
      .from(blocksTable)
      .where(eq(blocksTable.blockerId, reporter.userId));
    assert.equal(blockRow?.blockedId, spammer.userId);

    // 4. Non-admin gets 403 on admin endpoints
    const nonAdminKpi = await fetch(`${base}/api/admin/kpis`, {
      headers: { Cookie: reporter.cookie },
    });
    assert.equal(nonAdminKpi.status, 403);

    // 5. Admin inspects KPIs, lists reports, and resolves with 'ban'
    const adminKpiRes = await fetch(`${base}/api/admin/kpis`, {
      headers: { Cookie: adminUser.cookie },
    });
    assert.equal(adminKpiRes.status, 200);
    const kpiJson = (await adminKpiRes.json()) as {
      totalUsers: number;
      pendingReports: number;
      urgentReports: number;
    };
    assert.ok(kpiJson.totalUsers >= 3);
    assert.ok(kpiJson.pendingReports >= 1);
    assert.ok(kpiJson.urgentReports >= 1);

    const resolveRes = await fetch(`${base}/api/admin/reports/${repJson.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: adminUser.cookie },
      body: JSON.stringify({ action: 'ban' }),
    });
    assert.equal(resolveRes.status, 200);

    // Spammer session is now revoked & account suspended
    const spammerSession = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: spammer.cookie },
    });
    assert.equal(((await spammerSession.json()) as { authenticated: boolean }).authenticated, false);

    const [deletedPost] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, targetPostId));
    assert.equal(deletedPost, undefined);
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      for (const uid of createdUserIds) {
        await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, `%${uid}%`));
      }
      if (createdReportIds.length > 0) {
        await db.delete(reportsTable).where(inArray(reportsTable.id, createdReportIds));
      }
      if (createdPostIds.length > 0) {
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
