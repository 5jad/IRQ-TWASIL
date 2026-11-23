import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { eq, inArray, like } from 'drizzle-orm';
import { resetEnvCache } from './env.ts';
import { createAppServer } from '../../server.ts';
import { closeDbPool, getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  botUpdatesTable,
  conversationsTable,
  conversationMembersTable,
  otpChallengesTable,
  rateLimitsTable,
  usersTable,
} from '../db/schema.ts';
import { hmacPhone } from './phone.ts';
import { setTestOtpListener } from './otp.ts';
import { isDisallowedIp, validateExternalHttpsUrl } from './ssrf.ts';
import { sanitizeBotText, validateBotOutboundContent } from './bots.ts';
import { BOT_FACTORY_ID } from './botFactory.ts';

test('SSRF validator blocks loopback, private, CGNAT, metadata, IPv6-mapped and non-HTTPS URLs', async () => {
  assert.equal(isDisallowedIp('127.0.0.1'), true);
  assert.equal(isDisallowedIp('10.0.0.1'), true);
  assert.equal(isDisallowedIp('172.16.5.4'), true);
  assert.equal(isDisallowedIp('192.168.1.10'), true);
  assert.equal(isDisallowedIp('169.254.169.254'), true);
  assert.equal(isDisallowedIp('100.64.0.5'), true);
  assert.equal(isDisallowedIp('::1'), true);
  assert.equal(isDisallowedIp('fe80::1'), true);
  assert.equal(isDisallowedIp('fc00::1'), true);
  assert.equal(isDisallowedIp('::ffff:127.0.0.1'), true);
  assert.equal(isDisallowedIp('::ffff:169.254.169.254'), true);
  assert.equal(isDisallowedIp('8.8.8.8'), false);

  await assert.rejects(() => validateExternalHttpsUrl('http://example.com/hook'));
  await assert.rejects(() => validateExternalHttpsUrl('https://localhost/hook'));
  await assert.rejects(() => validateExternalHttpsUrl('https://127.0.0.1/hook'));
  await assert.rejects(() => validateExternalHttpsUrl('https://169.254.169.254/latest/meta-data/'));
  await assert.rejects(() => validateExternalHttpsUrl('https://10.0.0.1/internal'));
  await assert.rejects(() => validateExternalHttpsUrl('https://8.8.8.8:8443/hook'));
  const okIp = await validateExternalHttpsUrl('https://8.8.8.8/hook');
  assert.equal(okIp.resolvedIp, '8.8.8.8');
});

test('bot sanitizer neutralizes XSS and outbound filter catches credential phishing', () => {
  const dirty = '<b>مرحبا</b><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">x</a>';
  const clean = sanitizeBotText(dirty, 'HTML');
  assert.ok(clean.includes('<b>مرحبا</b>'));
  assert.ok(!clean.includes('<script>'));
  assert.ok(clean.includes('&lt;script&gt;'));
  assert.ok(!clean.includes('<img'));

  assert.ok(validateBotOutboundContent('أرسل رمز التحقق OTP مع رقم هاتفك الآن!'));
  assert.equal(validateBotOutboundContent('مرحباً بك في البوت الإخباري'), null);
});

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] ?? '' : '';
}

test('@botfactory_bot creation, HTTP Bot API, /start opt-in, callback_query, privacy mode & block', async (t) => {
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
          displayName: 'صاحب البوت',
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
    const owner = await createUser('bown', `+964770${r1}`);
    const endUser = await createUser('busr', `+964780${r2}`);

    // Ensure owner account is >24h old for bot creation
    await db
      .update(usersTable)
      .set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) })
      .where(eq(usersTable.id, owner.userId));

    // 1. Talk to @botfactory_bot to create a bot
    const startFactory = await fetch(`${base}/api/bots/${BOT_FACTORY_ID}/start`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: owner.cookie },
    });
    assert.equal(startFactory.status, 200);
    const { conversationId: factoryConvId } = (await startFactory.json()) as { conversationId: string };
    createdConvIds.push(factoryConvId);

    const newbotStep1 = await fetch(`${base}/api/conversations/${factoryConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: owner.cookie },
      body: JSON.stringify({ text: '/newbot' }),
    });
    assert.equal(newbotStep1.status, 201);
    await new Promise((r) => setTimeout(r, 80));

    const newbotStep2 = await fetch(`${base}/api/conversations/${factoryConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: owner.cookie },
      body: JSON.stringify({ text: 'بوت الاختبار الذكي' }),
    });
    assert.equal(newbotStep2.status, 201);
    await new Promise((r) => setTimeout(r, 80));

    const botHandle = `iq_echo_${crypto.randomBytes(3).toString('hex')}_bot`;
    const newbotStep3 = await fetch(`${base}/api/conversations/${factoryConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: owner.cookie },
      body: JSON.stringify({ text: botHandle }),
    });
    assert.equal(newbotStep3.status, 201);

    // Poll owner's bootstrap to read @botfactory_bot token reply
    let rawToken = '';
    for (let i = 0; i < 15; i++) {
      const boot = (await (
        await fetch(`${base}/api/bootstrap`, { headers: { Cookie: owner.cookie } })
      ).json()) as {
        messagesByConversation: Record<string, Array<{ senderId: string; text: string }>>;
      };
      const msgs = boot.messagesByConversation[factoryConvId] ?? [];
      const tokenMsg = msgs.find((m) => m.senderId === BOT_FACTORY_ID && m.text.includes('bot-'));
      if (tokenMsg) {
        const lines = tokenMsg.text.split('\n');
        rawToken = lines[lines.length - 1]?.trim() ?? '';
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    assert.ok(rawToken.includes(':'), `Expected raw token from @botfactory_bot, got: ${rawToken}`);
    const botId = rawToken.split(':')[0]!;
    createdUserIds.push(botId);

    // 2. Public directory & getMe via both auth styles
    const dirRes = await fetch(`${base}/api/bots`);
    assert.equal(dirRes.status, 200);
    const dirJson = (await dirRes.json()) as { bots: Array<{ id: string; handle: string }> };
    assert.ok(dirJson.bots.some((b) => b.handle === botHandle));

    const me1 = await fetch(`${base}/api/bot/v1/getMe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: '{}',
    });
    assert.equal(me1.status, 200);
    assert.equal(((await me1.json()) as { result: { username: string } }).result.username, botHandle);

    const me2 = await fetch(`${base}/bot${rawToken}/getMe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(me2.status, 200);

    // 3. setWebhook rejects SSRF targets
    const ssrfRes = await fetch(`${base}/api/bot/v1/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ url: 'https://127.0.0.1/hook' }),
    });
    assert.equal(ssrfRes.status, 400);

    // 4. Bot cannot DM user who hasn't started it -> 403
    const noStartSend = await fetch(`${base}/api/bot/v1/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ chat_id: endUser.userId, text: 'سبام قبل البدء' }),
    });
    assert.ok(noStartSend.status === 403 || noStartSend.status === 404);

    // 5. End user clicks Start on bot -> bot polls getUpdates -> replies -> clicks inline callback
    const userStartRes = await fetch(`${base}/api/bots/${botId}/start`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: endUser.cookie },
    });
    assert.equal(userStartRes.status, 200);
    const { conversationId: userBotConvId } = (await userStartRes.json()) as { conversationId: string };
    createdConvIds.push(userBotConvId);

    const gu1 = await fetch(`${base}/api/bot/v1/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ timeout: 0 }),
    });
    assert.equal(gu1.status, 200);
    const gu1Json = (await gu1.json()) as { result: Array<{ update_id: number; message?: { text: string } }> };
    assert.equal(gu1Json.result.length, 1);
    assert.equal(gu1Json.result[0]?.message?.text, '/start');
    const firstUpdateId = gu1Json.result[0]!.update_id;

    // Bot sends message with inline keyboard + sanitized HTML
    const botReplyRes = await fetch(`${base}/api/bot/v1/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({
        chat_id: userBotConvId,
        text: '<b>أهلاً!</b><script>xss()</script>',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'تأكيد', callback_data: 'confirm_btn' }]] },
      }),
    });
    assert.equal(botReplyRes.status, 200);
    const { result: sentMsg } = (await botReplyRes.json()) as {
      result: { message_id: string; text: string };
    };
    assert.ok(!sentMsg.text.includes('<script>'));

    // User clicks inline button -> callback_query delivered to bot
    const cbClick = await fetch(`${base}/api/conversations/${userBotConvId}/callback-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: endUser.cookie },
      body: JSON.stringify({ messageId: sentMsg.message_id, data: 'confirm_btn' }),
    });
    assert.equal(cbClick.status, 200);

    // Wait >1s for getUpdates 1/sec rate limit
    await new Promise((r) => setTimeout(r, 1100));
    const gu2 = await fetch(`${base}/api/bot/v1/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ offset: firstUpdateId + 1 }),
    });
    const gu2Json = (await gu2.json()) as {
      result: Array<{ update_id: number; callback_query?: { id: string; data: string } }>;
    };
    assert.equal(gu2Json.result.length, 1);
    assert.equal(gu2Json.result[0]?.callback_query?.data, 'confirm_btn');

    const ansCb = await fetch(`${base}/api/bot/v1/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({
        callback_query_id: gu2Json.result[0]!.callback_query!.id,
        text: 'تم!',
      }),
    });
    assert.equal(ansCb.status, 200);

    // 6. Group privacy mode: bot receives /cmd & @mention, skips normal chat
    const grpId = `conv-grp-${crypto.randomBytes(4).toString('hex')}`;
    createdConvIds.push(grpId);
    await db.insert(conversationsTable).values({
      id: grpId,
      title: 'مجموعة تجربة البوت',
      avatarUrl: '/seed/avatar-1.svg',
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      isGroup: true,
      sortTs: Date.now(),
    });
    await db.insert(conversationMembersTable).values([
      { conversationId: grpId, userId: endUser.userId, role: 'member' },
      { conversationId: grpId, userId: botId, role: 'bot' },
    ]);

    await fetch(`${base}/api/conversations/${grpId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: endUser.cookie },
      body: JSON.stringify({ text: 'حديث عادي بالمجموعة' }),
    });
    await fetch(`${base}/api/conversations/${grpId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-CSRF': '1', Cookie: endUser.cookie },
      body: JSON.stringify({ text: `مرحبا @${botHandle}` }),
    });

    await new Promise((r) => setTimeout(r, 1100));
    const gu3 = await fetch(`${base}/api/bot/v1/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ offset: gu2Json.result[0]!.update_id + 1 }),
    });
    const gu3Json = (await gu3.json()) as {
      result: Array<{ update_id: number; message?: { text: string } }>;
    };
    assert.equal(gu3Json.result.length, 1);
    assert.ok(gu3Json.result[0]?.message?.text.includes(`@${botHandle}`));

    // 7. User blocks bot -> my_chat_member queued & sendMessage returns 403
    const blockRes = await fetch(`${base}/api/bots/${botId}/block`, {
      method: 'POST',
      headers: { 'X-TW-CSRF': '1', Cookie: endUser.cookie },
    });
    assert.equal(blockRes.status, 200);

    const blockedSend = await fetch(`${base}/api/bot/v1/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${rawToken}` },
      body: JSON.stringify({ chat_id: userBotConvId, text: 'بعد الحظر' }),
    });
    assert.equal(blockedSend.status, 403);

    const updatesAfterBlock = await db
      .select()
      .from(botUpdatesTable)
      .where(eq(botUpdatesTable.botId, botId));
    assert.ok(
      updatesAfterBlock.some(
        (u) => (u.payloadJson as { my_chat_member?: { new_chat_member?: { status: string } } })?.my_chat_member?.new_chat_member?.status === 'kicked'
      )
    );
  } finally {
    setTestOtpListener(null);
    if (hasDatabaseConfig()) {
      const db = getDb();
      if (createdConvIds.length > 0) {
        await db.delete(conversationsTable).where(inArray(conversationsTable.id, createdConvIds));
      }
      if (createdUserIds.length > 0) {
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
