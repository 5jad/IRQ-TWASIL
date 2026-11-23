import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type http from 'node:http';
import sharp from 'sharp';
import { eq, inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  mediaTable,
  otpChallengesTable,
  postsTable,
  rateLimitsTable,
  storiesTable,
  usersTable,
} from '../db/schema.ts';
import { hmacPhone } from './phone.ts';
import { setTestOtpListener } from './otp.ts';
import { inspectMagicBytes, runMediaCleanupOnce } from './media.ts';

test('inspectMagicBytes enforces real signatures and rejects SVG/HTML/executables', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const gifHeader = Buffer.from('GIF89a\x01\x00\x01\x00');
  const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const htmlBytes = Buffer.from('<!DOCTYPE html><html><body>xss</body></html>');
  const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

  assert.equal(inspectMagicBytes(pngHeader, 'image/png'), true);
  assert.equal(inspectMagicBytes(jpegHeader, 'image/jpeg'), true);
  assert.equal(inspectMagicBytes(gifHeader, 'image/gif'), true);
  assert.equal(inspectMagicBytes(jpegHeader, 'image/png'), false);
  assert.equal(inspectMagicBytes(svgBytes, 'image/png'), false);
  assert.equal(inspectMagicBytes(htmlBytes, 'text/plain'), false);
  assert.equal(inspectMagicBytes(exeBytes, 'application/zip'), false);
});

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] ?? '' : '';
}

test('signed upload, EXIF strip, blurhash/thumb, ownership enforcement, and cleanup', async (t) => {
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
  const createdMediaIds: string[] = [];
  const createdPostIds: string[] = [];
  const createdStoryIds: string[] = [];

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
          displayName: 'مستخدم وسائط',
          province: 'بغداد',
          birthYear: 1996,
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
    const userA = await createUser('meda', `+964770${r1}`);
    const userB = await createUser('medb', `+964780${r2}`);

    // 1. Reject SVG MIME and oversize
    const svgInit = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ kind: 'post-image', mime: 'image/svg+xml', sizeBytes: 1024 }),
    });
    assert.equal(svgInit.status, 400);

    const bigInit = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ kind: 'avatar', mime: 'image/png', sizeBytes: 9 * 1024 * 1024 }),
    });
    assert.equal(bigInit.status, 400);

    // 2. Create real JPEG with fake EXIF metadata -> verify EXIF stripped + blurhash + thumb created
    const imgWithExif = await sharp({
      create: { width: 120, height: 150, channels: 3, background: { r: 15, g: 118, b: 110 } },
    })
      .withExif({ IFD0: { Copyright: 'SECRET_GPS_TEST_CAMERA' } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const initRes = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        kind: 'post-image',
        mime: 'image/jpeg',
        sizeBytes: imgWithExif.length,
      }),
    });
    assert.equal(initRes.status, 201);
    const initJson = (await initRes.json()) as {
      mediaId: string;
      uploadUrl: string;
      method: string;
    };
    createdMediaIds.push(initJson.mediaId);

    // Pending media cannot be attached to a post yet
    const pendingPostRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ text: 'قبل الاكتمال', mediaId: initJson.mediaId }),
    });
    assert.equal(pendingPostRes.status, 400);

    const putRes = await fetch(`${base}${initJson.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(imgWithExif),
    });
    assert.equal(putRes.status, 200);

    // User B cannot complete A's upload
    const bComplete = await fetch(`${base}/api/media/uploads/${initJson.mediaId}/complete`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userB.cookie },
    });
    assert.equal(bComplete.status, 403);

    const completeRes = await fetch(`${base}/api/media/uploads/${initJson.mediaId}/complete`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
    });
    assert.equal(completeRes.status, 200);
    const compJson = (await completeRes.json()) as {
      status: string;
      publicUrl: string;
      thumbUrl: string;
      width: number;
      height: number;
      blurhash: string;
    };
    assert.equal(compJson.status, 'ready');
    assert.equal(compJson.width, 120);
    assert.equal(compJson.height, 150);
    assert.ok(compJson.blurhash && compJson.blurhash.length > 5);
    assert.ok(compJson.thumbUrl.startsWith('/media/'));

    // Public object fetch verifies stripped EXIF and security headers
    const pubFetch = await fetch(`${base}${compJson.publicUrl}`);
    assert.equal(pubFetch.status, 200);
    assert.equal(pubFetch.headers.get('x-content-type-options'), 'nosniff');
    const pubBytes = Buffer.from(await pubFetch.arrayBuffer());
    const meta = await sharp(pubBytes).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.format, 'webp');

    // User B cannot attach A's mediaId
    const bUsePost = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userB.cookie },
      body: JSON.stringify({ text: 'سرقة وسائط', mediaId: initJson.mediaId }),
    });
    assert.equal(bUsePost.status, 403);

    // User A attaches ready mediaId -> 201, and reusing same mediaId fails -> 409
    const postId = `post-med-${crypto.randomBytes(4).toString('hex')}`;
    createdPostIds.push(postId);
    const aPost = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ id: postId, text: 'منشور بصورة', mediaId: initJson.mediaId }),
    });
    assert.equal(aPost.status, 201);

    const reusePost = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ text: 'تكرار', mediaId: initJson.mediaId }),
    });
    assert.equal(reusePost.status, 409);

    // 3. Disguised SVG inside PNG upload is rejected on complete
    const badInit = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ kind: 'post-image', mime: 'image/png', sizeBytes: 64 }),
    });
    const badJson = (await badInit.json()) as { mediaId: string; uploadUrl: string };
    createdMediaIds.push(badJson.mediaId);
    await fetch(`${base}${badJson.uploadUrl}`, {
      method: 'PUT',
      body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    });
    const badComplete = await fetch(`${base}/api/media/uploads/${badJson.mediaId}/complete`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
    });
    assert.equal(badComplete.status, 400);

    // 4. Cleanup removes stale pending and expired stories
    const staleId = `med-stale-${crypto.randomBytes(4).toString('hex')}`;
    createdMediaIds.push(staleId);
    await db.insert(mediaTable).values({
      id: staleId,
      ownerId: userA.userId,
      kind: 'post-image',
      status: 'pending',
      stagingKey: `staging/${userA.userId}/${staleId}`,
      mime: 'image/png',
      declaredSizeBytes: 100,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    const expStoryId = `story-exp-${crypto.randomBytes(4).toString('hex')}`;
    createdStoryIds.push(expStoryId);
    await db.insert(storiesTable).values({
      id: expStoryId,
      authorId: userA.userId,
      mediaUrl: '',
      mediaType: 'text',
      caption: 'منتهية',
      durationSec: 5,
      audience: 'everyone',
      mode: 'story',
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      sortTs: Date.now() - 30 * 60 * 60 * 1000,
    });

    const cleaned = await runMediaCleanupOnce();
    assert.ok(cleaned.stalePendingCleaned >= 1);
    assert.ok(cleaned.expiredStoriesCleaned >= 1);

    const [staleAfter] = await db
      .select({ status: mediaTable.status })
      .from(mediaTable)
      .where(eq(mediaTable.id, staleId));
    assert.equal(staleAfter?.status, 'deleted');

    // 5. Newly registered user does not inherit legacy or NULL-recipient notifications
    const bootRes = await fetch(`${base}/api/bootstrap`, {
      headers: { Cookie: userA.cookie },
    });
    assert.equal(bootRes.status, 200);
    const bootJson = (await bootRes.json()) as {
      authenticated: boolean;
      currentUser: { id: string } | null;
      notifications: Array<{ id: string }>;
    };
    assert.equal(bootJson.authenticated, true);
    assert.equal(bootJson.currentUser?.id, userA.userId);
    assert.equal(bootJson.notifications.length, 0);

    // 6. Story image upload + publish with fractional durationSec succeeds
    const storyInitRes = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        kind: 'story-image',
        mime: 'image/jpeg',
        sizeBytes: imgWithExif.length,
      }),
    });
    assert.equal(storyInitRes.status, 201);
    const storyInitJson = (await storyInitRes.json()) as { mediaId: string; uploadUrl: string };
    createdMediaIds.push(storyInitJson.mediaId);
    const storyPut = await fetch(`${base}${storyInitJson.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(imgWithExif),
    });
    assert.equal(storyPut.status, 200);
    const storyComplete = await fetch(`${base}/api/media/uploads/${storyInitJson.mediaId}/complete`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
    });
    assert.equal(storyComplete.status, 200);

    const storyId = `story-med-${crypto.randomBytes(4).toString('hex')}`;
    createdStoryIds.push(storyId);
    const storyPub = await fetch(`${base}/api/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        id: storyId,
        kind: 'story',
        mediaId: storyInitJson.mediaId,
        mediaType: 'image',
        durationSec: 4.7,
        audience: 'everyone',
        mode: 'story',
      }),
    });
    assert.equal(storyPub.status, 201);
    const storyPubJson = (await storyPub.json()) as { id: string; mediaUrl: string };
    assert.equal(storyPubJson.id, storyId);
    assert.ok(storyPubJson.mediaUrl.startsWith('/media/'));

    // 7. Avatar and cover upload via PATCH /api/users/me return complete User DTO without wiping identity fields
    async function uploadImageForUser(kind: 'avatar' | 'cover') {
      const upInit = await fetch(`${base}/api/media/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
        body: JSON.stringify({
          kind,
          mime: 'image/jpeg',
          sizeBytes: imgWithExif.length,
        }),
      });
      assert.equal(upInit.status, 201);
      const upInitJson = (await upInit.json()) as { mediaId: string; uploadUrl: string };
      createdMediaIds.push(upInitJson.mediaId);

      const upPut = await fetch(`${base}${upInitJson.uploadUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(imgWithExif),
      });
      assert.equal(upPut.status, 200);

      const upComplete = await fetch(`${base}/api/media/uploads/${upInitJson.mediaId}/complete`, {
        method: 'POST',
        headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
      });
      assert.equal(upComplete.status, 200);
      return upInitJson.mediaId;
    }

    const avatarMediaId = await uploadImageForUser('avatar');
    const avatarPatchRes = await fetch(`${base}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ avatarMediaId }),
    });
    assert.equal(avatarPatchRes.status, 200);
    const avatarUserJson = (await avatarPatchRes.json()) as {
      ok: boolean;
      id: string;
      handle: string;
      username: string;
      displayName: string;
      province: string;
      avatarUrl: string;
    };
    assert.equal(avatarUserJson.ok, true);
    assert.equal(avatarUserJson.id, userA.userId);
    assert.ok(avatarUserJson.handle.startsWith('meda_'));
    assert.equal(avatarUserJson.username, avatarUserJson.handle);
    assert.equal(avatarUserJson.displayName, 'مستخدم وسائط');
    assert.equal(avatarUserJson.province, 'بغداد');
    assert.ok(avatarUserJson.avatarUrl.startsWith('/media/'));

    const avatarFetch = await fetch(`${base}${avatarUserJson.avatarUrl}`);
    assert.equal(avatarFetch.status, 200);
    assert.equal(avatarFetch.headers.get('content-type'), 'image/webp');

    const coverMediaId = await uploadImageForUser('cover');
    const coverPatchRes = await fetch(`${base}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({ coverMediaId }),
    });
    assert.equal(coverPatchRes.status, 200);
    const coverUserJson = (await coverPatchRes.json()) as {
      ok: boolean;
      id: string;
      avatarUrl: string;
      coverUrl?: string;
    };
    assert.equal(coverUserJson.ok, true);
    assert.equal(coverUserJson.id, userA.userId);
    assert.equal(coverUserJson.avatarUrl, avatarUserJson.avatarUrl);
    assert.ok(coverUserJson.coverUrl?.startsWith('/media/'));

    // 8. Reel publish via POST /api/posts with kind='reel' persists as a reel post (not a story)
    const reelInitRes = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        kind: 'post-image',
        mime: 'image/jpeg',
        sizeBytes: imgWithExif.length,
      }),
    });
    assert.equal(reelInitRes.status, 201);
    const reelInitJson = (await reelInitRes.json()) as { mediaId: string; uploadUrl: string };
    createdMediaIds.push(reelInitJson.mediaId);
    const reelPut = await fetch(`${base}${reelInitJson.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(imgWithExif),
    });
    assert.equal(reelPut.status, 200);
    const reelComplete = await fetch(`${base}/api/media/uploads/${reelInitJson.mediaId}/complete`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: userA.cookie },
    });
    assert.equal(reelComplete.status, 200);

    const reelId = `reel-test-${crypto.randomBytes(4).toString('hex')}`;
    createdPostIds.push(reelId);
    const reelPubRes = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userA.cookie },
      body: JSON.stringify({
        id: reelId,
        text: 'ريلز تجريبي',
        mediaId: reelInitJson.mediaId,
        kind: 'reel',
        audioTrack: 'دجلة عند الغروب — راست',
        aspectRatio: '9/16',
      }),
    });
    assert.equal(reelPubRes.status, 201);
    const reelPubJson = (await reelPubRes.json()) as {
      id: string;
      kind: string;
      audioTrack?: string;
      media?: Array<{ url: string; aspectRatio: string }>;
    };
    assert.equal(reelPubJson.id, reelId);
    assert.equal(reelPubJson.kind, 'reel');
    assert.equal(reelPubJson.audioTrack, 'دجلة عند الغروب — راست');
    assert.equal(reelPubJson.media?.[0]?.aspectRatio, '9/16');

    const afterReelBootRes = await fetch(`${base}/api/bootstrap`, {
      headers: { Cookie: userA.cookie },
    });
    assert.equal(afterReelBootRes.status, 200);
    const afterReelBoot = (await afterReelBootRes.json()) as {
      posts: Array<{ id: string; kind: string }>;
      storiesByUser: Record<string, Array<{ id: string }>>;
    };
    assert.ok(afterReelBoot.posts.some((p) => p.id === reelId && p.kind === 'reel'));
    assert.ok(!(afterReelBoot.storiesByUser[userA.userId] ?? []).some((s) => s.id === reelId));

    // 9. Transparent PNG avatar upload preserves alpha transparency
    const alphaPng = await sharp({
      create: { width: 128, height: 128, channels: 4, background: { r: 220, g: 38, b: 38, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 64, height: 64, channels: 4, background: { r: 15, g: 118, b: 110, alpha: 1 } },
          })
            .png()
            .toBuffer(),
          top: 32,
          left: 32,
        },
      ])
      .png()
      .toBuffer();

    const pngInitRes = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userB.cookie },
      body: JSON.stringify({ kind: 'avatar', mime: 'image/png', sizeBytes: alphaPng.length }),
    });
    assert.equal(pngInitRes.status, 201);
    const pngInit = (await pngInitRes.json()) as { mediaId: string; uploadUrl: string };
    createdMediaIds.push(pngInit.mediaId);
    const pngPut = await fetch(`${base}${pngInit.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array(alphaPng),
    });
    assert.equal(pngPut.status, 200);
    const pngComp = await fetch(`${base}/api/media/uploads/${pngInit.mediaId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userB.cookie },
      body: JSON.stringify({}),
    });
    assert.equal(pngComp.status, 200);
    const pngCompJson = (await pngComp.json()) as { publicUrl: string; width: number; height: number };
    const pngOutBytes = Buffer.from(await (await fetch(`${base}${pngCompJson.publicUrl}`)).arrayBuffer());
    const pngOutMeta = await sharp(pngOutBytes).metadata();
    assert.equal(pngOutMeta.hasAlpha, true);
    assert.equal(pngOutMeta.width, 128);
    assert.equal(pngOutMeta.height, 128);

    // 10. Animated GIF upload with crop metadata crops & scales while preserving multi-frame animation
    const gifTmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-gif-test-'));
    let animGifBuf: Buffer;
    try {
      const gifPath = path.join(gifTmp, 'anim.gif');
      execFileSync(
        'ffmpeg',
        ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=0.6:size=320x160:rate=10', gifPath],
        { stdio: 'ignore' }
      );
      animGifBuf = await fs.readFile(gifPath);
    } finally {
      await fs.rm(gifTmp, { recursive: true, force: true }).catch(() => undefined);
    }

    const gifInitRes = await fetch(`${base}/api/media/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userB.cookie },
      body: JSON.stringify({ kind: 'avatar', mime: 'image/gif', sizeBytes: animGifBuf.length }),
    });
    assert.equal(gifInitRes.status, 201);
    const gifInit = (await gifInitRes.json()) as { mediaId: string; uploadUrl: string };
    createdMediaIds.push(gifInit.mediaId);
    const gifPut = await fetch(`${base}${gifInit.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/gif' },
      body: new Uint8Array(animGifBuf),
    });
    assert.equal(gifPut.status, 200);

    const gifComp = await fetch(`${base}/api/media/uploads/${gifInit.mediaId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: userB.cookie },
      body: JSON.stringify({
        crop: {
          sx: 160,
          sy: 0,
          sw: 160,
          sh: 160,
          dx: 0,
          dy: 0,
          dw: 512,
          dh: 512,
          outputWidth: 512,
          outputHeight: 512,
          fitMode: 'cover',
        },
      }),
    });
    assert.equal(gifComp.status, 200);
    const gifCompJson = (await gifComp.json()) as { publicUrl: string; width: number; height: number };
    assert.equal(gifCompJson.width, 512);
    assert.equal(gifCompJson.height, 512);
    const gifOutBytes = Buffer.from(await (await fetch(`${base}${gifCompJson.publicUrl}`)).arrayBuffer());
    const gifOutMeta = await sharp(gifOutBytes, { animated: true }).metadata();
    assert.ok((gifOutMeta.pages ?? 1) > 1);
    assert.equal(gifOutMeta.width, 512);
    assert.equal(gifOutMeta.pageHeight, 512);
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      if (createdPostIds.length > 0) {
        await db.delete(postsTable).where(inArray(postsTable.id, createdPostIds));
      }
      if (createdStoryIds.length > 0) {
        await db.delete(storiesTable).where(inArray(storiesTable.id, createdStoryIds));
      }
      if (createdMediaIds.length > 0) {
        await db.delete(mediaTable).where(inArray(mediaTable.id, createdMediaIds));
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
