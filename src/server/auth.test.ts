import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { eq, inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  conversationsTable,
  otpChallengesTable,
  postsTable,
  rateLimitsTable,
  sessionsTable,
  storiesTable,
  usersTable,
} from '../db/schema.ts';
import {
  decryptPhone,
  encryptPhone,
  hmacPhone,
  normalizePhoneToE164,
  validateHandle,
} from './phone.ts';
import { setTestOtpListener } from './otp.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { maskE164Phone } from './dto.ts';

test('phone normalization handles Iraqi formats, Arabic-Indic numerals, and rejects invalid/VoIP', () => {
  assert.equal(normalizePhoneToE164('07701234567'), '+9647701234567');
  assert.equal(normalizePhoneToE164('+964 780 123 4567'), '+9647801234567');
  assert.equal(normalizePhoneToE164('٠٧٧٠١٢٣٤٥٦٧'), '+9647701234567');
  assert.equal(normalizePhoneToE164('009647501234567'), '+9647501234567');
  assert.throws(() => normalizePhoneToE164('12345'));
  assert.equal(maskE164Phone('+9647701234567'), '+964 7•• ••• ••67');
});

test('phone AES-256-GCM encryption and HMAC roundtrip cleanly', () => {
  const e164 = '+9647701234567';
  const enc1 = encryptPhone(e164);
  const enc2 = encryptPhone(e164);
  assert.notEqual(enc1, enc2); // unique random IV
  assert.equal(decryptPhone(enc1), e164);
  assert.equal(decryptPhone(enc2), e164);
  assert.equal(hmacPhone(e164), hmacPhone(e164));
  assert.notEqual(hmacPhone(e164), hmacPhone('+9647801234567'));
});

test('handle validation enforces format, reserved words, and _bot suffix rules', () => {
  assert.equal(validateHandle('Ali_Baghdad.99').ok, true);
  assert.equal(validateHandle('irq').ok, true);
  assert.equal(validateHandle('ab').ok, false);
  assert.equal(validateHandle('.ali').ok, false);
  assert.equal(validateHandle('ali.').ok, false);
  assert.equal(validateHandle('ali..iq').ok, false);
  assert.equal(validateHandle('admin').ok, false);
  assert.equal(validateHandle('botfactory_bot').ok, false);
  assert.equal(validateHandle('my_helper_bot').ok, false);
  assert.equal(validateHandle('my_helper_bot', { isBot: true }).ok, true);
  assert.equal(validateHandle('my_helper', { isBot: true }).ok, false);
});

test('scrypt password hashing and verification roundtrip cleanly', () => {
  const hash = hashPassword('MyTestPass#99');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(verifyPassword('MyTestPass#99', hash), true);
  assert.equal(verifyPassword('wrong-pass', hash), false);
  assert.equal(verifyPassword('MyTestPass#99', 'invalid'), false);
  assert.equal(verifyPassword('', hash), false);
});

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(';')[0] ?? '';
}

test('full OTP auth, session rotation, CSRF, IDOR & per-viewer isolation', async (t) => {
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
  const createdConvIds: string[] = [];
  const createdPostIds: string[] = [];
  const createdStoryIds: string[] = [];

  try {
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;
    const db = getDb();

    // Generate 3 unique test Iraqi phones so runs never collide
    const randSuffix = () => String(crypto.randomInt(1000000, 9999999));
    const phoneA = `+964770${randSuffix()}`;
    const phoneB = `+964780${randSuffix()}`;
    const phoneC = `+964750${randSuffix()}`;
    const phoneLock = `+964771${randSuffix()}`;
    createdPhoneHmacs.push(hmacPhone(phoneA), hmacPhone(phoneB), hmacPhone(phoneC), hmacPhone(phoneLock));

    let capturedCode = '';
    setTestOtpListener((_phone, code) => {
      capturedCode = code;
    });

    // 1. Unauthenticated write -> 401; CSRF check -> 403
    const noCsrfRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    assert.equal(noCsrfRes.status, 403);

    const wrongOriginRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TW-CSRF': '1',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ text: 'test' }),
    });
    assert.equal(wrongOriginRes.status, 403);

    const unauthPostRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ text: 'test' }),
    });
    assert.equal(unauthPostRes.status, 401);

    // 2. OTP resend cooldown + 5 failed attempts + 24h lock after 3 failed challenges
    for (let attempt = 0; attempt < 3; attempt++) {
      // Clear cooldown row between test rounds by deleting previous challenges for phoneLock
      if (attempt > 0) {
        await db
          .update(otpChallengesTable)
          .set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
          .where(eq(otpChallengesTable.phoneHmac, hmacPhone(phoneLock)));
      }
      const reqRes = await fetch(`${base}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ phone: phoneLock, purpose: 'login' }),
      });
      assert.equal(reqRes.status, 200);
      const { challengeId } = (await reqRes.json()) as { challengeId: string };

      if (attempt === 0) {
        // Immediate resend -> 429 + Retry-After
        const resendRes = await fetch(`${base}/api/auth/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
          body: JSON.stringify({ phone: phoneLock, purpose: 'login' }),
        });
        assert.equal(resendRes.status, 429);
        assert.ok(Number(resendRes.headers.get('retry-after')) >= 1);
      }

      // 5 wrong attempts exhaust challenge
      for (let w = 0; w < 5; w++) {
        const wrongCode = capturedCode === '000000' ? '111111' : '000000';
        const vRes = await fetch(`${base}/api/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
          body: JSON.stringify({ challengeId, code: wrongCode }),
        });
        assert.equal(vRes.status, attempt === 2 && w === 4 ? 429 : 400);
      }
    }
    const lockedRes = await fetch(`${base}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ phone: phoneLock, purpose: 'login' }),
    });
    assert.equal(lockedRes.status, 429);
    const lockedJson = (await lockedRes.json()) as { error: string };
    assert.equal(lockedJson.error, 'otp_locked');

    // Helper to sign up a test user cleanly
    async function signupUser(phone: string, handle: string, displayName: string, password?: string) {
      const otpReq = await fetch(`${base}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ phone, purpose: 'signup' }),
      });
      assert.equal(otpReq.status, 200);
      const { challengeId } = (await otpReq.json()) as { challengeId: string };

      const otpVerify = await fetch(`${base}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({ challengeId, code: capturedCode }),
      });
      assert.equal(otpVerify.status, 200);
      const vJson = (await otpVerify.json()) as { status: string; signupToken: string };
      assert.equal(vJson.status, 'needs_signup');

      const signupRes = await fetch(`${base}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
        body: JSON.stringify({
          signupToken: vJson.signupToken,
          handle,
          displayName,
          province: 'بغداد',
          birthYear: 1998,
          accountType: 'personal',
          ...(password ? { password } : {}),
          acceptedTerms: true,
        }),
      });
      assert.equal(signupRes.status, 201);
      const cookie = extractCookie(signupRes);
      assert.ok(cookie.length > 10);
      const sJson = (await signupRes.json()) as { user: { id: string; maskedPhone: string } };
      createdUserIds.push(sJson.user.id);
      return { user: sJson.user, cookie };
    }

    const suffix = crypto.randomBytes(3).toString('hex');
    const userA = await signupUser(phoneA, `test_a_${suffix}`, 'مستخدم أ', 'TestPass#123');
    const userB = await signupUser(phoneB, `test_b_${suffix}`, 'مستخدم ب');
    const userC = await signupUser(phoneC, `test_c_${suffix}`, 'مستخدم ج');

    // Password login check (handle & phone + reject wrong password)
    const badPwRes = await fetch(`${base}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ identifier: `@test_a_${suffix}`, password: 'wrong' }),
    });
    assert.equal(badPwRes.status, 401);

    const pwHandleRes = await fetch(`${base}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ identifier: `@test_a_${suffix}`, password: 'TestPass#123' }),
    });
    assert.equal(pwHandleRes.status, 200);
    assert.ok(extractCookie(pwHandleRes).length > 10);

    const pwPhoneRes = await fetch(`${base}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ identifier: phoneA, password: 'TestPass#123' }),
    });
    assert.equal(pwPhoneRes.status, 200);
    const pwPhoneJson = (await pwPhoneRes.json()) as {
      status: string;
      user: { id: string };
      sessionToken?: string;
    };
    assert.ok(pwPhoneJson.sessionToken && pwPhoneJson.sessionToken.length > 10);

    // Bearer fallback works without any Cookie header (e.g., inside 3P-cookie-blocked iframe)
    const bearerSessionRes = await fetch(`${base}/api/auth/session`, {
      headers: { Authorization: `Bearer ${pwPhoneJson.sessionToken}` },
    });
    assert.equal(bearerSessionRes.status, 200);
    const bearerSessionJson = (await bearerSessionRes.json()) as {
      authenticated: boolean;
      user: { id: string } | null;
    };
    assert.equal(bearerSessionJson.authenticated, true);
    assert.equal(bearerSessionJson.user?.id, userA.user.id);

    // Handle availability endpoint check
    const availRes = await fetch(`${base}/api/auth/handle-available?handle=test_a_${suffix}`);
    assert.equal(availRes.status, 200);
    assert.equal(((await availRes.json()) as { available: boolean }).available, false);

    // 3. Forged authorId rejected by .strict() schema
    const forgedRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TW-CSRF': '1',
        Cookie: userA.cookie,
      },
      body: JSON.stringify({ text: 'منشور حقيقي', authorId: userB.user.id }),
    });
    assert.equal(forgedRes.status, 400);

    // A creates post & text story
    const postId = `post-test-${suffix}`;
    createdPostIds.push(postId);
    const postRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ id: postId, text: 'منشور للاختبار الأمني' }),
    });
    assert.equal(postRes.status, 201);

    const storyId = `story-test-${suffix}`;
    createdStoryIds.push(storyId);
    const storyRes = await fetch(`${base}/api/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        id: storyId,
        mediaType: 'text',
        caption: 'قصة نصية',
        audience: 'everyone',
        mode: 'story',
        durationSec: 5,
      }),
    });
    assert.equal(storyRes.status, 201);

    // IDOR: User B cannot delete A's post or A's story -> 403
    const bDeletePost = await fetch(`${base}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'X-TW-CSRF': '1', Cookie: userB.cookie },
    });
    assert.equal(bDeletePost.status, 403);

    const bDeleteStory = await fetch(`${base}/api/stories/${storyId}`, {
      method: 'DELETE',
      headers: { 'X-TW-CSRF': '1', Cookie: userB.cookie },
    });
    assert.equal(bDeleteStory.status, 403);

    // 4. Conversation membership enforcement (returns 404, not 403, for non-members)
    const convStartRes = await fetch(`${base}/api/conversations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ recipientId: userB.user.id }),
    });
    assert.equal(convStartRes.status, 201);
    const { id: convId } = (await convStartRes.json()) as { id: string };
    createdConvIds.push(convId);

    const cMsgRes = await fetch(`${base}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userC.cookie },
      body: JSON.stringify({ text: 'محاولة اختراق' }),
    });
    assert.equal(cMsgRes.status, 404);

    const cReadRes = await fetch(`${base}/api/conversations/${convId}/read`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userC.cookie },
    });
    assert.equal(cReadRes.status, 404);

    // 5. Per-viewer isolation on follow flag
    const followRes = await fetch(`${base}/api/users/${userB.user.id}/follow`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
    });
    assert.equal(followRes.status, 200);

    const bootA = (await (
      await fetch(`${base}/api/bootstrap`, { headers: { Cookie: userA.cookie } })
    ).json()) as { users: Array<{ id: string; isFollowing: boolean }> };
    const bootC = (await (
      await fetch(`${base}/api/bootstrap`, { headers: { Cookie: userC.cookie } })
    ).json()) as { users: Array<{ id: string; isFollowing: boolean }> };

    assert.equal(bootA.users.find((u) => u.id === userB.user.id)?.isFollowing, true);
    assert.equal(bootC.users.find((u) => u.id === userB.user.id)?.isFollowing, false);

    // 6. Handle change 14-day cooldown
    const h1 = await fetch(`${base}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ handle: `new_a_${suffix}` }),
    });
    assert.equal(h1.status, 200);

    const h2 = await fetch(`${base}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ handle: `new_a2_${suffix}` }),
    });
    assert.equal(h2.status, 429);

    // 7. Session 24h rotation & device list + revocation
    await db
      .update(sessionsTable)
      .set({ lastRotatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(sessionsTable.userId, userA.user.id));

    const rotRes = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: userA.cookie },
    });
    assert.equal(rotRes.status, 200);
    const rotatedCookie = extractCookie(rotRes);
    assert.ok(rotatedCookie && rotatedCookie !== userA.cookie);

    // Old cookie is now invalid
    const oldCookieRes = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: userA.cookie },
    });
    assert.equal(((await oldCookieRes.json()) as { authenticated: boolean }).authenticated, false);

    const devicesRes = await fetch(`${base}/api/auth/devices`, {
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(devicesRes.status, 200);
    const { devices } = (await devicesRes.json()) as { devices: Array<{ id: string; isCurrent: boolean }> };
    assert.equal(devices.length, 3);
    assert.equal(devices.filter((d) => d.isCurrent).length, 1);

    // 8. Account deletion requires OTP and revokes sessions
    // Advance OTP timestamp so userC isn't hit by 60s cooldown from signup
    await db
      .update(otpChallengesTable)
      .set({ createdAt: new Date(Date.now() - 120 * 1000) })
      .where(eq(otpChallengesTable.phoneHmac, hmacPhone(phoneC)));

    const delOtpReq = await fetch(`${base}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userC.cookie },
      body: JSON.stringify({ phone: phoneC, purpose: 'delete-account' }),
    });
    assert.equal(delOtpReq.status, 200);
    const { challengeId: delChallengeId } = (await delOtpReq.json()) as { challengeId: string };

    const delRes = await fetch(`${base}/api/auth/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userC.cookie },
      body: JSON.stringify({ challengeId: delChallengeId, code: capturedCode }),
    });
    assert.equal(delRes.status, 200);

    const afterDelSession = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: userC.cookie },
    });
    assert.equal(((await afterDelSession.json()) as { authenticated: boolean }).authenticated, false);

    // 9. Email + dotted handle password login & privacy check (email only in SelfUserDto)
    const emailUserId = `u-email-${suffix}`;
    const emailHandle = `em.${suffix}`;
    const userEmail = `Test.${suffix}@example.com`;
    createdUserIds.push(emailUserId);
    await db.insert(usersTable).values({
      id: emailUserId,
      username: emailHandle,
      handle: emailHandle,
      email: userEmail.toLowerCase(),
      passwordHash: hashPassword('$/Sa/13#'),
      displayName: 'اختبار إيميل',
      avatarUrl: '/seed/avatar-1.svg',
      bio: '',
      province: 'بغداد',
      accountType: 'personal',
      role: 'user',
      kind: 'person',
      status: 'active',
      sortOrder: 500,
    });

    const emailLoginRes = await fetch(`${base}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ identifier: userEmail, password: '$/Sa/13#' }),
    });
    assert.equal(emailLoginRes.status, 200);
    const emailLoginJson = (await emailLoginRes.json()) as {
      status: string;
      user: { id: string; handle: string; email?: string };
    };
    assert.equal(emailLoginJson.status, 'authenticated');
    assert.equal(emailLoginJson.user.id, emailUserId);
    assert.equal(emailLoginJson.user.handle, emailHandle);
    assert.equal(emailLoginJson.user.email, userEmail.toLowerCase());

    const handleLoginRes = await fetch(`${base}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1' },
      body: JSON.stringify({ identifier: `@${emailHandle}`, password: '$/Sa/13#' }),
    });
    assert.equal(handleLoginRes.status, 200);

    // Ensure email is NOT leaked in public users list on /api/bootstrap
    const bootEmailCheck = (await (
      await fetch(`${base}/api/bootstrap`, { headers: { Cookie: userA.cookie } })
    ).json()) as { users: Array<{ id: string; email?: string }> };
    const pubEmailUser = bootEmailCheck.users.find((u) => u.id === emailUserId);
    assert.ok(pubEmailUser);
    assert.equal(pubEmailUser.email, undefined);
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      if (createdConvIds.length > 0) {
        await db.delete(conversationsTable).where(inArray(conversationsTable.id, createdConvIds));
      }
      if (createdPostIds.length > 0) {
        await db.delete(postsTable).where(inArray(postsTable.id, createdPostIds));
      }
      if (createdStoryIds.length > 0) {
        await db.delete(storiesTable).where(inArray(storiesTable.id, createdStoryIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
      }
      if (createdPhoneHmacs.length > 0) {
        await db
          .delete(otpChallengesTable)
          .where(inArray(otpChallengesTable.phoneHmac, createdPhoneHmacs));
      }
      await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, 'rl:otp_%'));
      await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, 'rl:signup:%'));
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDbPool();
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    resetEnvCache();
  }
});
