import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  conversationsTable,
  eventsTable,
  otpChallengesTable,
  rateLimitsTable,
  usersTable,
} from '../db/schema.ts';
import { hmacPhone } from './phone.ts';
import { setTestOtpListener } from './otp.ts';
import { emitUserEvent } from './events.ts';

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] ?? '' : '';
}

test('SSE stream delivers live events, replays via Last-Event-ID, and delta endpoint works', async (t) => {
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

  try {
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;
    const db = getDb();

    // Unauthenticated SSE -> 401
    const unauthSse = await fetch(`${base}/api/events`);
    assert.equal(unauthSse.status, 401);

    let capturedCode = '';
    setTestOtpListener((_phone, code) => {
      capturedCode = code;
    });

    const phone = `+964770${crypto.randomInt(1000000, 9999999)}`;
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
        handle: `sse_${crypto.randomBytes(3).toString('hex')}`,
        displayName: 'مستخدم بث مباشر',
        province: 'بغداد',
        birthYear: 1997,
        accountType: 'personal',
        acceptedTerms: true,
      }),
    });
    const cookie = extractCookie(sRes);
    const { user } = (await sRes.json()) as { user: { id: string } };
    createdUserIds.push(user.id);

    // 1. Open SSE stream and wait for connected + live message event
    const ac = new AbortController();
    const sseRes = await fetch(`${base}/api/events`, {
      headers: { Cookie: cookie },
      signal: ac.signal,
    });
    assert.equal(sseRes.status, 200);
    assert.match(sseRes.headers.get('content-type') ?? '', /text\/event-stream/);

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let collected = '';

    const readLoop = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          collected += decoder.decode(value, { stream: true });
          if (collected.includes('event: test:ping')) break;
        }
      } catch {
        // Expected on abort
      }
    })();

    await new Promise((r) => setTimeout(r, 80));
    const evt1 = await emitUserEvent(user.id, 'test:ping', { hello: 'baghdad' });
    assert.ok(evt1?.id);

    await Promise.race([readLoop, new Promise((r) => setTimeout(r, 2000))]);
    ac.abort();
    await reader.cancel().catch(() => undefined);

    assert.match(collected, /event: connected/);
    assert.match(collected, /event: test:ping/);
    assert.match(collected, /"hello":"baghdad"/);

    // 2. Emit another event while disconnected, verify Last-Event-ID replay and delta polling
    const evt2 = await emitUserEvent(user.id, 'test:missed', { missed: true });
    assert.ok(evt2?.id && evt2.id > evt1!.id);

    const deltaRes = await fetch(`${base}/api/bootstrap/delta?since=${evt1!.id}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(deltaRes.status, 200);
    const deltaJson = (await deltaRes.json()) as {
      lastEventId: number;
      events: Array<{ id: number; eventType: string }>;
    };
    assert.equal(deltaJson.lastEventId, evt2!.id);
    assert.ok(deltaJson.events.some((e) => e.eventType === 'test:missed'));

    const ac2 = new AbortController();
    const replayRes = await fetch(`${base}/api/events`, {
      headers: { Cookie: cookie, 'Last-Event-ID': String(evt1!.id) },
      signal: ac2.signal,
    });
    const replayReader = replayRes.body!.getReader();
    let replayBuf = '';
    const replayPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await replayReader.read();
          if (done) break;
          replayBuf += decoder.decode(value, { stream: true });
          if (replayBuf.includes('event: test:missed')) break;
        }
      } catch {
        // Expected on abort
      }
    })();
    await Promise.race([replayPromise, new Promise((r) => setTimeout(r, 1500))]);
    ac2.abort();
    await replayReader.cancel().catch(() => undefined);
    assert.match(replayBuf, /event: test:missed/);

    await db.delete(eventsTable).where(inArray(eventsTable.recipientUserId, createdUserIds));
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      if (createdConvIds.length > 0) {
        await db.delete(conversationsTable).where(inArray(conversationsTable.id, createdConvIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(eventsTable).where(inArray(eventsTable.recipientUserId, createdUserIds));
        for (const uid of createdUserIds) {
          await db.delete(rateLimitsTable).where(like(rateLimitsTable.key, `%${uid}%`));
        }
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
