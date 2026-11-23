import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Express, Request, Response, NextFunction } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  botChatStateTable,
  botCommandsTable,
  botTokensTable,
  botUpdatesTable,
  botWebhooksTable,
  conversationMembersTable,
  conversationsTable,
  mediaTable,
  messagesTable,
  notificationsTable,
  usersTable,
} from '../db/schema.ts';
import { encryptPhone, decryptPhone } from './phone.ts';
import { requireAuth, type AuthenticatedRequest } from './auth.ts';
import { sendApiError, validateBody } from './schemas.ts';
import { ssrfSafeRequest, SsrfError, validateExternalHttpsUrl } from './ssrf.ts';
import { emitConversationEvent, emitUserEvent } from './events.ts';
import { BOT_FACTORY_ID, handleBotFactoryInteraction, issueBotToken } from './botFactory.ts';
import { getMediaStorage } from './storage.ts';
import { inspectMagicBytes } from './media.ts';
import { logger } from './logger.ts';
import { toPublicUser } from './dto.ts';
import type { BotReplyMarkup } from '../types/index.ts';

const botUpdateEmitter = new EventEmitter();
botUpdateEmitter.setMaxListeners(200);

// Tracks callback_query_id -> { userId, conversationId, expiresAt }
const callbackQueryTargets = new Map<
  string,
  { userId: string; conversationId: string; botId: string; expiresAt: number }
>();

// Lightweight token-bucket / fixed-window memory map for fast per-bot/per-chat/per-sec limits
const botThrottleMap = new Map<string, { tokens: number; lastRefillMs: number }>();

function consumeTokenBucket(key: string, capacity: number, refillPerSec: number): number | null {
  const now = Date.now();
  let bucket = botThrottleMap.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefillMs: now };
    botThrottleMap.set(key, bucket);
  }
  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) {
    return Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSec));
  }
  bucket.tokens -= 1;
  return null;
}

export function sanitizeBotText(raw: string, parseMode?: 'HTML' | 'Markdown'): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  if (parseMode !== 'HTML') {
    return escaped;
  }

  // Restore ONLY safe allowlisted formatting tags and https links
  const simpleTags = ['b', 'i', 'u', 's', 'code', 'pre'];
  let out = escaped;
  for (const tag of simpleTags) {
    const openRe = new RegExp(`&lt;${tag}&gt;`, 'gi');
    const closeRe = new RegExp(`&lt;/${tag}&gt;`, 'gi');
    out = out.replace(openRe, `<${tag}>`).replace(closeRe, `</${tag}>`);
  }

  // Allow safe <a href="https://...">...</a>
  out = out.replace(
    /&lt;a\s+href=(?:&quot;|&#39;)(https:\/\/[^&\s"'<>]+)(?:&quot;|&#39;)&gt;([\s\S]*?)&lt;\/a&gt;/gi,
    (_m, href: string, label: string) => `<a href="${href}" rel="noopener noreferrer">${label}</a>`
  );
  return out;
}

export function validateBotOutboundContent(text: string): string | null {
  const urlMatches = text.match(/https?:\/\/\S+/gi) ?? [];
  if (urlMatches.length > 5) {
    return 'الرسالة تحتوي على عدد كبير جداً من الروابط';
  }
  const lower = text.toLowerCase();
  if (
    (lower.includes('رمز التحقق') || lower.includes('otp') || lower.includes('كلمة السر')) &&
    (lower.includes('رقم هاتف') || lower.includes('أرسل رقمك') || urlMatches.length > 0)
  ) {
    return 'يُمنع طلب رموز التحقق أو أرقام الهواتف الحساسة من المستخدمين';
  }
  return null;
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export async function authenticateBotToken(
  rawToken: string
): Promise<typeof usersTable.$inferSelect | null> {
  const sep = rawToken.indexOf(':');
  if (sep <= 0) return null;
  const botId = rawToken.slice(0, sep).trim();
  const secret = rawToken.slice(sep + 1).trim();
  if (!botId || !secret) return null;

  const db = getDb();
  const rows = await db
    .select({
      token: botTokensTable,
      bot: usersTable,
    })
    .from(botTokensTable)
    .innerJoin(usersTable, eq(botTokensTable.botId, usersTable.id))
    .where(
      and(
        eq(botTokensTable.botId, botId),
        sql`${botTokensTable.revokedAt} IS NULL`,
        eq(usersTable.kind, 'bot'),
        eq(usersTable.status, 'active')
      )
    );

  const candidateHash = hashSecret(secret);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  for (const row of rows) {
    const storedBuf = Buffer.from(row.token.secretHash, 'hex');
    if (candidateBuf.length === storedBuf.length && crypto.timingSafeEqual(candidateBuf, storedBuf)) {
      return row.bot;
    }
  }
  return null;
}

function checkBotRateLimits(
  bot: typeof usersTable.$inferSelect,
  method: string,
  conversationId?: string,
  isGroup = false
): number | null {
  const isNewBot = Date.now() - bot.createdAt.getTime() < 24 * 60 * 60 * 1000;
  const factor = isNewBot ? 0.5 : 1;

  if (method === 'getUpdates') {
    return consumeTokenBucket(`bot:gu:${bot.id}`, 1, 1);
  }

  const botGlobal = consumeTokenBucket(`bot:g:${bot.id}`, Math.max(1, Math.floor(30 * factor)), Math.max(1, 30 * factor));
  if (botGlobal) return botGlobal;

  if (conversationId) {
    if (isGroup) {
      const grp = consumeTokenBucket(
        `bot:grp:${bot.id}:${conversationId}`,
        Math.max(1, Math.floor(20 * factor)),
        Math.max(0.1, (20 * factor) / 60)
      );
      if (grp) return grp;
    } else {
      const dm = consumeTokenBucket(
        `bot:dm:${bot.id}:${conversationId}`,
        Math.max(1, Math.floor(3 * factor)),
        Math.max(0.5, 1 * factor)
      );
      if (dm) return dm;
    }
  }
  return null;
}

async function resolveBotConversation(
  botId: string,
  chatId: string
): Promise<{
  conversation: typeof conversationsTable.$inferSelect;
  peerUserId: string | null;
}> {
  const db = getDb();

  // First try direct conversation ID match
  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, chatId))
    .limit(1);

  if (!conv) {
    // Try resolving chatId as userId via directKey
    const directKey = [botId, chatId].sort().join(':');
    [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.directKey, directKey))
      .limit(1);
  }

  if (!conv) {
    throw { status: 404, description: 'Chat not found' };
  }

  const members = await db
    .select()
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.conversationId, conv.id));

  const botMember = members.find((m) => m.userId === botId);
  if (!botMember) {
    throw { status: 403, description: 'Bot is not a member of this chat' };
  }

  let peerUserId: string | null = null;
  if (!conv.isGroup) {
    peerUserId = members.find((m) => m.userId !== botId)?.userId ?? null;
    if (peerUserId) {
      const [state] = await db
        .select()
        .from(botChatStateTable)
        .where(and(eq(botChatStateTable.botId, botId), eq(botChatStateTable.userId, peerUserId)))
        .limit(1);
      if (!state || !state.startedAt) {
        throw { status: 403, description: 'User has not started this bot yet' };
      }
      if (state.blockedAt) {
        throw { status: 403, description: 'Forbidden: bot was blocked by the user' };
      }
    }
  }

  return { conversation: conv, peerUserId };
}

export async function enqueueBotUpdate(
  botId: string,
  payload: Record<string, unknown>
): Promise<number> {
  const db = getDb();
  const [inserted] = await db
    .insert(botUpdatesTable)
    .values({
      botId,
      payloadJson: payload,
      attempts: 0,
    })
    .returning();

  const updateId = inserted!.updateId;
  const fullPayload = { update_id: updateId, ...payload };

  await db
    .update(botUpdatesTable)
    .set({ payloadJson: fullPayload })
    .where(eq(botUpdatesTable.updateId, updateId));

  botUpdateEmitter.emit(`update:${botId}`, fullPayload);

  // Trigger webhook delivery asynchronously if active
  void attemptWebhookDelivery(botId, updateId, fullPayload, 0);

  return updateId;
}

const WEBHOOK_RETRY_DELAYS_MS = [1000, 5000, 30000];
const MAX_CONSECUTIVE_WEBHOOK_FAILURES = 20;

async function attemptWebhookDelivery(
  botId: string,
  updateId: number,
  payload: Record<string, unknown>,
  attemptIndex: number
): Promise<void> {
  if (!hasDatabaseConfig()) return;
  const db = getDb();
  const [webhook] = await db
    .select()
    .from(botWebhooksTable)
    .where(eq(botWebhooksTable.botId, botId))
    .limit(1);

  if (!webhook || webhook.disabledAt || !webhook.url) return;

  const secret = webhook.secretTokenEnc ? decryptPhone(webhook.secretTokenEnc) : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'TawasulBotAPI/1.0',
  };
  if (secret) {
    headers['X-Tawasul-Bot-Api-Secret-Token'] = secret;
  }

  try {
    const res = await ssrfSafeRequest(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      maxResponseBytes: 256 * 1024,
    });
    if (res.status >= 200 && res.status < 300) {
      await db.transaction(async (tx) => {
        await tx
          .update(botUpdatesTable)
          .set({ deliveredAt: new Date(), ackedAt: new Date() })
          .where(eq(botUpdatesTable.updateId, updateId));
        if (webhook.failureCount > 0 || webhook.lastError) {
          await tx
            .update(botWebhooksTable)
            .set({ failureCount: 0, lastError: null, updatedAt: new Date() })
            .where(eq(botWebhooksTable.botId, botId));
        }
      });
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Webhook delivery error';
    const nextFailures = webhook.failureCount + 1;
    const shouldDisable = nextFailures >= MAX_CONSECUTIVE_WEBHOOK_FAILURES;

    await db
      .update(botWebhooksTable)
      .set({
        failureCount: nextFailures,
        lastError: errMsg.slice(0, 300),
        lastErrorAt: new Date(),
        ...(shouldDisable ? { disabledAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(botWebhooksTable.botId, botId));

    await db
      .update(botUpdatesTable)
      .set({ attempts: attemptIndex + 1 })
      .where(eq(botUpdatesTable.updateId, updateId));

    if (shouldDisable) {
      const [botUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, botId))
        .limit(1);
      if (botUser?.ownerId) {
        const notifId = `notif-${crypto.randomUUID().slice(0, 12)}`;
        const nowIso = new Date().toISOString();
        const targetText = `تم تعطيل Webhook للبوت @${botUser.handle ?? botId} بعد ٢٠ محاولة فاشلة`;
        await db.insert(notificationsTable).values({
          id: notifId,
          actorId: botId,
          recipientId: botUser.ownerId,
          kind: 'system',
          targetText,
          time: nowIso,
          isRead: false,
          sortOrder: 0,
        });
        await emitUserEvent(botUser.ownerId, 'notification:new', {
          id: notifId,
          actor: toPublicUser(botUser),
          kind: 'system',
          targetText,
          time: nowIso,
          isRead: false,
        });
      }
      return;
    }

    if (attemptIndex < WEBHOOK_RETRY_DELAYS_MS.length) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attemptIndex]!;
      const timer = setTimeout(() => {
        void attemptWebhookDelivery(botId, updateId, payload, attemptIndex + 1);
      }, delay);
      timer.unref();
    }
  }
}

export async function routeUserMessageToBots(input: {
  actorId: string;
  conversationId: string;
  messageId: string;
  text: string;
  mediaId?: string;
  replyToMessageId?: string;
}): Promise<void> {
  const db = getDb();

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, input.conversationId))
    .limit(1);
  if (!conv) return;

  const members = await db
    .select({
      user: usersTable,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(conversationMembersTable.conversationId, input.conversationId),
        eq(usersTable.kind, 'bot'),
        eq(usersTable.status, 'active')
      )
    );

  if (members.length === 0) return;

  const [sender] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, input.actorId))
    .limit(1);

  for (const { user: bot } of members) {
    if (bot.id === input.actorId) continue;

    // Special internal handler for @botfactory_bot
    if (bot.id === BOT_FACTORY_ID && !conv.isGroup) {
      void handleBotFactoryInteraction({
        actorId: input.actorId,
        conversationId: input.conversationId,
        text: input.text,
        mediaId: input.mediaId,
      }).catch((err) => {
        logger.error({ err }, '@botfactory_bot handler error');
      });
      continue;
    }

    // Group privacy mode check
    if (conv.isGroup && bot.botPrivacyMode) {
      const botHandle = (bot.handle ?? bot.username).toLowerCase();
      const trimmed = input.text.trim();
      const isCommand = trimmed.startsWith('/');
      const isMention = trimmed.toLowerCase().includes(`@${botHandle}`);
      let isReplyToBot = false;
      if (input.replyToMessageId) {
        const [replied] = await db
          .select({ senderId: messagesTable.senderId })
          .from(messagesTable)
          .where(eq(messagesTable.id, input.replyToMessageId))
          .limit(1);
        isReplyToBot = replied?.senderId === bot.id;
      }
      if (!isCommand && !isMention && !isReplyToBot) {
        continue;
      }
    }

    // DM opt-in check: sending a message in DM starts/resumes unless user explicitly blocked
    if (!conv.isGroup) {
      const [state] = await db
        .select()
        .from(botChatStateTable)
        .where(and(eq(botChatStateTable.botId, bot.id), eq(botChatStateTable.userId, input.actorId)))
        .limit(1);

      if (state?.blockedAt && !input.text.trim().startsWith('/start')) {
        continue;
      }
      await db
        .insert(botChatStateTable)
        .values({
          botId: bot.id,
          userId: input.actorId,
          conversationId: input.conversationId,
          startedAt: new Date(),
          blockedAt: null,
        })
        .onConflictDoUpdate({
          target: [botChatStateTable.botId, botChatStateTable.userId],
          set: {
            conversationId: input.conversationId,
            startedAt: sql`COALESCE(${botChatStateTable.startedAt}, NOW())`,
            ...(input.text.trim().startsWith('/start') ? { blockedAt: null } : {}),
          },
        });
    }

    await enqueueBotUpdate(bot.id, {
      message: {
        message_id: input.messageId,
        chat: {
          id: input.conversationId,
          type: conv.isGroup ? 'group' : 'private',
          title: conv.title,
        },
        from: {
          id: input.actorId,
          is_bot: false,
          username: sender?.handle ?? sender?.username,
          first_name: sender?.displayName ?? 'مستخدم',
        },
        date: Math.floor(Date.now() / 1000),
        text: input.text,
        ...(input.mediaId ? { file_id: input.mediaId } : {}),
      },
    });
  }
}

async function handleBotApiMethod(
  bot: typeof usersTable.$inferSelect,
  method: string,
  body: Record<string, unknown>,
  res: Response
): Promise<void> {
  const db = getDb();

  const chatIdParam = typeof body.chat_id === 'string' ? body.chat_id : undefined;

  if (method === 'getMe') {
    const rl = checkBotRateLimits(bot, 'getMe');
    if (rl) {
      res.setHeader('Retry-After', String(rl));
      res.status(429).json({ ok: false, error_code: 429, description: `Too Many Requests: retry after ${rl}` });
      return;
    }
    res.json({
      ok: true,
      result: {
        id: bot.id,
        is_bot: true,
        first_name: bot.displayName,
        username: bot.handle ?? bot.username,
        can_join_groups: bot.botCanJoinGroups,
        can_read_all_group_messages: !bot.botPrivacyMode,
        supports_inline_queries: false,
      },
    });
    return;
  }

  if (method === 'getUpdates') {
    const rl = checkBotRateLimits(bot, 'getUpdates');
    if (rl) {
      res.setHeader('Retry-After', String(rl));
      res.status(429).json({ ok: false, error_code: 429, description: `Too Many Requests: retry after ${rl}` });
      return;
    }

    const [wh] = await db
      .select()
      .from(botWebhooksTable)
      .where(and(eq(botWebhooksTable.botId, bot.id), sql`${botWebhooksTable.disabledAt} IS NULL`))
      .limit(1);
    if (wh && wh.url) {
      res.status(409).json({
        ok: false,
        error_code: 409,
        description: 'Conflict: can\'t use getUpdates method while webhook is active',
      });
      return;
    }

    const offset = typeof body.offset === 'number' && Number.isInteger(body.offset) ? body.offset : undefined;
    const limit =
      typeof body.limit === 'number' && Number.isInteger(body.limit)
        ? Math.min(100, Math.max(1, body.limit))
        : 100;
    const timeoutSec =
      typeof body.timeout === 'number' && Number.isFinite(body.timeout)
        ? Math.min(30, Math.max(0, body.timeout))
        : 0;

    if (offset !== undefined) {
      await db
        .update(botUpdatesTable)
        .set({ ackedAt: new Date() })
        .where(
          and(
            eq(botUpdatesTable.botId, bot.id),
            sql`${botUpdatesTable.updateId} < ${offset}`,
            sql`${botUpdatesTable.ackedAt} IS NULL`
          )
        );
    }

    const fetchPending = async () =>
      db
        .select()
        .from(botUpdatesTable)
        .where(
          and(
            eq(botUpdatesTable.botId, bot.id),
            sql`${botUpdatesTable.ackedAt} IS NULL`,
            ...(offset !== undefined ? [sql`${botUpdatesTable.updateId} >= ${offset}`] : [])
          )
        )
        .orderBy(asc(botUpdatesTable.updateId))
        .limit(limit);

    let pending = await fetchPending();
    if (pending.length === 0 && timeoutSec > 0) {
      await new Promise<void>((resolve) => {
        const onUpdate = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          botUpdateEmitter.off(`update:${bot.id}`, onUpdate);
          resolve();
        }, timeoutSec * 1000);
        botUpdateEmitter.once(`update:${bot.id}`, onUpdate);
      });
      pending = await fetchPending();
    }

    res.json({
      ok: true,
      result: pending.map((u) => u.payloadJson),
    });
    return;
  }

  if (method === 'setWebhook') {
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) {
      await db.delete(botWebhooksTable).where(eq(botWebhooksTable.botId, bot.id));
      res.json({ ok: true, result: true, description: 'Webhook was deleted' });
      return;
    }

    try {
      await validateExternalHttpsUrl(rawUrl);
    } catch (err) {
      const msg = err instanceof SsrfError ? err.message : 'Invalid webhook URL';
      res.status(400).json({ ok: false, error_code: 400, description: msg });
      return;
    }

    const secretToken =
      typeof body.secret_token === 'string' && body.secret_token.length > 0
        ? body.secret_token.slice(0, 256)
        : null;
    const allowedUpdates = Array.isArray(body.allowed_updates) ? body.allowed_updates : null;

    await db
      .insert(botWebhooksTable)
      .values({
        botId: bot.id,
        url: rawUrl,
        secretTokenHash: secretToken ? hashSecret(secretToken) : null,
        secretTokenEnc: secretToken ? encryptPhone(secretToken) : null,
        allowedUpdatesJson: allowedUpdates,
        failureCount: 0,
        lastError: null,
        lastErrorAt: null,
        disabledAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: botWebhooksTable.botId,
        set: {
          url: rawUrl,
          secretTokenHash: secretToken ? hashSecret(secretToken) : null,
          secretTokenEnc: secretToken ? encryptPhone(secretToken) : null,
          allowedUpdatesJson: allowedUpdates,
          failureCount: 0,
          lastError: null,
          lastErrorAt: null,
          disabledAt: null,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true, result: true, description: 'Webhook was set' });
    return;
  }

  if (method === 'deleteWebhook') {
    await db.delete(botWebhooksTable).where(eq(botWebhooksTable.botId, bot.id));
    res.json({ ok: true, result: true, description: 'Webhook was deleted' });
    return;
  }

  if (method === 'getWebhookInfo') {
    const [wh] = await db
      .select()
      .from(botWebhooksTable)
      .where(eq(botWebhooksTable.botId, bot.id))
      .limit(1);
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(botUpdatesTable)
      .where(and(eq(botUpdatesTable.botId, bot.id), sql`${botUpdatesTable.ackedAt} IS NULL`));

    res.json({
      ok: true,
      result: {
        url: wh?.url ?? '',
        has_custom_certificate: false,
        pending_update_count: pendingCount?.count ?? 0,
        last_error_date: wh?.lastErrorAt ? Math.floor(wh.lastErrorAt.getTime() / 1000) : undefined,
        last_error_message: wh?.lastError ?? undefined,
        disabled: Boolean(wh?.disabledAt),
      },
    });
    return;
  }

  if (method === 'setMyCommands') {
    const cmds = Array.isArray(body.commands) ? body.commands : [];
    const valid: Array<{ command: string; description: string }> = [];
    for (const item of cmds.slice(0, 50)) {
      if (item && typeof item === 'object') {
        const rec = item as { command?: unknown; description?: unknown };
        if (typeof rec.command === 'string' && typeof rec.description === 'string') {
          const c = rec.command.replace(/^\//, '').trim().toLowerCase();
          if (/^[a-z0-9_]{1,32}$/.test(c) && rec.description.trim().length > 0) {
            valid.push({ command: c, description: rec.description.trim().slice(0, 256) });
          }
        }
      }
    }
    await db.transaction(async (tx) => {
      await tx.delete(botCommandsTable).where(eq(botCommandsTable.botId, bot.id));
      if (valid.length > 0) {
        await tx.insert(botCommandsTable).values(
          valid.map((v, idx) => ({
            id: `bcmd-${crypto.randomUUID().slice(0, 10)}`,
            botId: bot.id,
            command: v.command,
            description: v.description,
            sortOrder: idx,
          }))
        );
      }
    });
    res.json({ ok: true, result: true });
    return;
  }

  if (method === 'getMyCommands') {
    const rows = await db
      .select()
      .from(botCommandsTable)
      .where(eq(botCommandsTable.botId, bot.id))
      .orderBy(asc(botCommandsTable.sortOrder));
    res.json({
      ok: true,
      result: rows.map((r) => ({ command: r.command, description: r.description })),
    });
    return;
  }

  if (method === 'deleteMyCommands') {
    await db.delete(botCommandsTable).where(eq(botCommandsTable.botId, bot.id));
    res.json({ ok: true, result: true });
    return;
  }

  if (method === 'getFile') {
    const fileId = typeof body.file_id === 'string' ? body.file_id.trim() : '';
    const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, fileId)).limit(1);
    if (!media || media.status !== 'ready' || !media.publicUrl) {
      res.status(404).json({ ok: false, error_code: 404, description: 'File not found' });
      return;
    }
    res.json({
      ok: true,
      result: {
        file_id: media.id,
        file_size: media.actualSizeBytes ?? media.declaredSizeBytes,
        file_path: media.publicUrl,
      },
    });
    return;
  }

  if (method === 'answerCallbackQuery') {
    const cqId = typeof body.callback_query_id === 'string' ? body.callback_query_id : '';
    const target = callbackQueryTargets.get(cqId);
    if (target) {
      callbackQueryTargets.delete(cqId);
      await emitUserEvent(target.userId, 'bot:callback_answer', {
        callbackQueryId: cqId,
        conversationId: target.conversationId,
        text: typeof body.text === 'string' ? sanitizeBotText(body.text) : '',
        showAlert: Boolean(body.show_alert),
      });
    }
    res.json({ ok: true, result: true });
    return;
  }

  // Methods requiring chat_id
  if (!chatIdParam) {
    res.status(400).json({ ok: false, error_code: 400, description: 'Bad Request: chat_id is required' });
    return;
  }

  const { conversation, peerUserId } = await resolveBotConversation(bot.id, chatIdParam);
  const rl = checkBotRateLimits(bot, method, conversation.id, conversation.isGroup);
  if (rl) {
    res.setHeader('Retry-After', String(rl));
    res.status(429).json({ ok: false, error_code: 429, description: `Too Many Requests: retry after ${rl}` });
    return;
  }

  if (method === 'sendChatAction') {
    const action = typeof body.action === 'string' ? body.action : 'typing';
    await emitConversationEvent(
      conversation.id,
      'chat:typing',
      { conversationId: conversation.id, userId: bot.id, action },
      { excludeUserId: bot.id }
    );
    res.json({ ok: true, result: true });
    return;
  }

  if (method === 'sendMessage') {
    const rawText = typeof body.text === 'string' ? body.text : '';
    if (!rawText.trim()) {
      res.status(400).json({ ok: false, error_code: 400, description: 'Bad Request: message text is empty' });
      return;
    }
    const spamErr = validateBotOutboundContent(rawText);
    if (spamErr) {
      res.status(400).json({ ok: false, error_code: 400, description: spamErr });
      return;
    }

    const parseMode =
      body.parse_mode === 'HTML' || body.parse_mode === 'Markdown' ? body.parse_mode : undefined;
    const safeText = sanitizeBotText(rawText, parseMode).slice(0, 4096);
    const replyMarkup =
      body.reply_markup && typeof body.reply_markup === 'object'
        ? (body.reply_markup as BotReplyMarkup)
        : undefined;
    const replyToMessageId =
      typeof body.reply_to_message_id === 'string' ? body.reply_to_message_id : null;

    const msgId = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const nowTs = Date.now();
    const isoNow = new Date(nowTs).toISOString();

    await db.transaction(async (tx) => {
      await tx.insert(messagesTable).values({
        id: msgId,
        conversationId: conversation.id,
        senderId: bot.id,
        text: safeText,
        timestamp: isoNow,
        isOwn: false,
        kind: 'text',
        status: 'delivered',
        replyToMessageId,
        replyMarkupJson: (replyMarkup ?? null) as Record<string, unknown> | null,
        sortTs: nowTs,
      });

      await tx
        .update(conversationsTable)
        .set({
          lastMessage: safeText.slice(0, 120),
          lastMessageTime: isoNow,
          sortTs: nowTs,
        })
        .where(eq(conversationsTable.id, conversation.id));

      await tx
        .update(conversationMembersTable)
        .set({ unreadCount: sql`${conversationMembersTable.unreadCount} + 1` })
        .where(
          and(
            eq(conversationMembersTable.conversationId, conversation.id),
            sql`${conversationMembersTable.userId} <> ${bot.id}`
          )
        );
    });

    await emitConversationEvent(
      conversation.id,
      'message:new',
      {
        conversationId: conversation.id,
        message: {
          id: msgId,
          senderId: bot.id,
          text: safeText,
          timestamp: isoNow,
          isOwn: false,
          kind: 'text',
          status: 'delivered',
          replyMarkup,
        },
      },
      { excludeUserId: bot.id }
    );

    res.json({
      ok: true,
      result: {
        message_id: msgId,
        chat: { id: conversation.id, type: conversation.isGroup ? 'group' : 'private' },
        date: Math.floor(nowTs / 1000),
        text: safeText,
        ...(peerUserId ? { to_user_id: peerUserId } : {}),
      },
    });
    return;
  }

  if (method === 'editMessageText') {
    const messageId = typeof body.message_id === 'string' ? body.message_id : '';
    const rawText = typeof body.text === 'string' ? body.text : '';
    if (!messageId || !rawText.trim()) {
      res.status(400).json({ ok: false, error_code: 400, description: 'Bad Request: message_id and text required' });
      return;
    }
    const [existing] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, conversation.id)))
      .limit(1);

    if (!existing || existing.senderId !== bot.id) {
      res.status(404).json({ ok: false, error_code: 404, description: 'Message not found' });
      return;
    }

    const parseMode =
      body.parse_mode === 'HTML' || body.parse_mode === 'Markdown' ? body.parse_mode : undefined;
    const safeText = sanitizeBotText(rawText, parseMode).slice(0, 4096);
    const replyMarkup =
      body.reply_markup && typeof body.reply_markup === 'object'
        ? (body.reply_markup as BotReplyMarkup)
        : undefined;

    await db
      .update(messagesTable)
      .set({
        text: safeText,
        editedAt: new Date(),
        ...(replyMarkup !== undefined ? { replyMarkupJson: replyMarkup as Record<string, unknown> } : {}),
      })
      .where(eq(messagesTable.id, messageId));

    await emitConversationEvent(
      conversation.id,
      'message:edited',
      { conversationId: conversation.id, messageId, text: safeText, replyMarkup },
      { excludeUserId: bot.id }
    );

    res.json({ ok: true, result: { message_id: messageId, text: safeText } });
    return;
  }

  if (method === 'deleteMessage') {
    const messageId = typeof body.message_id === 'string' ? body.message_id : '';
    const [existing] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, conversation.id)))
      .limit(1);
    if (!existing || existing.senderId !== bot.id) {
      res.status(404).json({ ok: false, error_code: 404, description: 'Message not found' });
      return;
    }

    await db
      .update(messagesTable)
      .set({ deletedAt: new Date() })
      .where(eq(messagesTable.id, messageId));

    await emitConversationEvent(
      conversation.id,
      'message:deleted',
      { conversationId: conversation.id, messageId },
      { excludeUserId: bot.id }
    );

    res.json({ ok: true, result: true });
    return;
  }

  if (
    method === 'sendPhoto' ||
    method === 'sendVideo' ||
    method === 'sendAudio' ||
    method === 'sendDocument'
  ) {
    const mediaIdInput = typeof body.media_id === 'string' ? body.media_id.trim() : '';
    const externalUrlInput =
      (typeof body.photo === 'string' && body.photo.trim()) ||
      (typeof body.video === 'string' && body.video.trim()) ||
      (typeof body.audio === 'string' && body.audio.trim()) ||
      (typeof body.document === 'string' && body.document.trim()) ||
      '';

    let finalMediaUrl = '';
    let finalMediaId: string | null = null;
    if (mediaIdInput) {
      const [m] = await db.select().from(mediaTable).where(eq(mediaTable.id, mediaIdInput)).limit(1);
      if (!m || m.status !== 'ready' || !m.publicUrl || (m.ownerId !== bot.id && m.ownerId !== bot.ownerId)) {
        res.status(400).json({ ok: false, error_code: 400, description: 'Invalid media_id' });
        return;
      }
      finalMediaUrl = m.publicUrl;
      finalMediaId = m.id;
    } else if (externalUrlInput.startsWith('https://')) {
      const dl = await ssrfSafeRequest(externalUrlInput, {
        method: 'GET',
        timeoutMs: 5000,
        maxResponseBytes: 10 * 1024 * 1024,
      });
      if (dl.status < 200 || dl.status >= 300 || dl.body.length === 0) {
        res.status(400).json({ ok: false, error_code: 400, description: 'Failed to fetch remote media' });
        return;
      }
      const rawMime = dl.contentType.split(';')[0]!.trim().toLowerCase() || 'application/octet-stream';
      if (!inspectMagicBytes(dl.body.subarray(0, 4096), rawMime)) {
        res.status(400).json({ ok: false, error_code: 400, description: 'Unsafe or invalid remote file content' });
        return;
      }
      const medId = `med-${crypto.randomUUID()}`;
      const pubKey = `public/${medId}/botfile`;
      finalMediaUrl = await getMediaStorage().putPublicObject(pubKey, dl.body, rawMime);
      finalMediaId = medId;
      await db.insert(mediaTable).values({
        id: medId,
        ownerId: bot.id,
        kind: method === 'sendPhoto' ? 'chat-image' : 'chat-file',
        status: 'ready',
        stagingKey: `staging/${bot.id}/${medId}`,
        publicKey: pubKey,
        publicUrl: finalMediaUrl,
        mime: rawMime,
        declaredSizeBytes: dl.body.length,
        actualSizeBytes: dl.body.length,
        usedByType: 'message',
        usedById: medId,
      });
    } else {
      res.status(400).json({ ok: false, error_code: 400, description: 'media_id or https URL is required' });
      return;
    }

    const caption = typeof body.caption === 'string' ? sanitizeBotText(body.caption) : '';
    const msgKind = method === 'sendPhoto' ? 'image' : 'file';
    const msgId = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const nowTs = Date.now();
    const isoNow = new Date(nowTs).toISOString();
    const replyMarkup =
      body.reply_markup && typeof body.reply_markup === 'object'
        ? (body.reply_markup as BotReplyMarkup)
        : undefined;

    await db.transaction(async (tx) => {
      await tx.insert(messagesTable).values({
        id: msgId,
        conversationId: conversation.id,
        senderId: bot.id,
        mediaId: finalMediaId,
        mediaUrl: finalMediaUrl,
        text: caption || 'مرفق من البوت',
        timestamp: isoNow,
        isOwn: false,
        kind: msgKind,
        status: 'delivered',
        replyMarkupJson: (replyMarkup ?? null) as Record<string, unknown> | null,
        sortTs: nowTs,
      });
      await tx
        .update(conversationsTable)
        .set({
          lastMessage: caption || 'مرفق من البوت',
          lastMessageTime: isoNow,
          sortTs: nowTs,
        })
        .where(eq(conversationsTable.id, conversation.id));
    });

    await emitConversationEvent(
      conversation.id,
      'message:new',
      {
        conversationId: conversation.id,
        message: {
          id: msgId,
          senderId: bot.id,
          text: caption || 'مرفق من البوت',
          mediaUrl: finalMediaUrl,
          timestamp: isoNow,
          isOwn: false,
          kind: msgKind,
          status: 'delivered',
          replyMarkup,
        },
      },
      { excludeUserId: bot.id }
    );

    res.json({ ok: true, result: { message_id: msgId, media_url: finalMediaUrl } });
    return;
  }

  res.status(404).json({ ok: false, error_code: 404, description: `Unknown method: ${method}` });
}

const CallbackQuerySchema = z
  .object({
    messageId: z.string().trim().min(1).max(64),
    data: z.string().min(1).max(256),
  })
  .strict();

export function registerBotRoutes(app: Express): void {
  // 1. Public bot directory & profile
  app.get('/api/bots', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const bots = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.kind, 'bot'),
            eq(usersTable.status, 'active'),
            eq(usersTable.botIsListed, true)
          )
        )
        .orderBy(asc(usersTable.sortOrder), desc(usersTable.followersCount));

      const botIds = bots.map((b) => b.id);
      const cmds =
        botIds.length > 0
          ? await db
              .select()
              .from(botCommandsTable)
              .where(inArray(botCommandsTable.botId, botIds))
              .orderBy(asc(botCommandsTable.sortOrder))
          : [];

      const cmdsByBot = new Map<string, Array<{ command: string; description: string }>>();
      for (const c of cmds) {
        const list = cmdsByBot.get(c.botId) ?? [];
        list.push({ command: c.command, description: c.description });
        cmdsByBot.set(c.botId, list);
      }

      res.json({
        bots: bots.map((b) => ({
          id: b.id,
          handle: b.handle ?? b.username,
          displayName: b.displayName,
          avatarUrl: b.avatarUrl,
          shortDescription: b.botShortDescription ?? b.bio,
          description: b.botDescription ?? b.bio,
          privacyMode: b.botPrivacyMode,
          canJoinGroups: b.botCanJoinGroups,
          isVerified: b.isVerified,
          commands: cmdsByBot.get(b.id) ?? [],
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/bots/mine/list', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      const bots = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.ownerId, authReq.auth!.userId),
            eq(usersTable.kind, 'bot'),
            eq(usersTable.status, 'active')
          )
        );
      const botIds = bots.map((b) => b.id);
      const [hooks, cmds] =
        botIds.length > 0
          ? await Promise.all([
              db.select().from(botWebhooksTable).where(inArray(botWebhooksTable.botId, botIds)),
              db
                .select()
                .from(botCommandsTable)
                .where(inArray(botCommandsTable.botId, botIds))
                .orderBy(asc(botCommandsTable.sortOrder)),
            ])
          : [[], []];

      const hookMap = new Map(hooks.map((h) => [h.botId, h]));
      res.json({
        bots: bots.map((b) => {
          const wh = hookMap.get(b.id);
          return {
            id: b.id,
            handle: b.handle ?? b.username,
            displayName: b.displayName,
            avatarUrl: b.avatarUrl,
            privacyMode: b.botPrivacyMode,
            webhook: wh
              ? {
                  url: wh.url,
                  failureCount: wh.failureCount,
                  lastError: wh.lastError,
                  disabled: Boolean(wh.disabledAt),
                }
              : null,
            commands: cmds
              .filter((c) => c.botId === b.id)
              .map((c) => ({ command: c.command, description: c.description })),
          };
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/bots/:handle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handle = String(req.params.handle).replace(/^@/, '').toLowerCase();
      const db = getDb();
      const [bot] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.kind, 'bot'),
            eq(usersTable.status, 'active'),
            sql`(${usersTable.handle} = ${handle} OR ${usersTable.username} = ${handle})`
          )
        )
        .limit(1);

      if (!bot) {
        sendApiError(res, 404, 'not_found', 'البوت غير موجود');
        return;
      }

      const cmds = await db
        .select()
        .from(botCommandsTable)
        .where(eq(botCommandsTable.botId, bot.id))
        .orderBy(asc(botCommandsTable.sortOrder));

      res.json({
        id: bot.id,
        handle: bot.handle ?? bot.username,
        displayName: bot.displayName,
        avatarUrl: bot.avatarUrl,
        shortDescription: bot.botShortDescription ?? bot.bio,
        description: bot.botDescription ?? bot.bio,
        privacyMode: bot.botPrivacyMode,
        canJoinGroups: bot.botCanJoinGroups,
        isVerified: bot.isVerified,
        commands: cmds.map((c) => ({ command: c.command, description: c.description })),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/bots/:botId/start', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const botId = String(req.params.botId);
      const db = getDb();

      const [bot] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.id, botId), eq(usersTable.kind, 'bot'), eq(usersTable.status, 'active')))
        .limit(1);
      if (!bot) {
        sendApiError(res, 404, 'not_found', 'البوت غير موجود');
        return;
      }

      const directKey = [authReq.auth!.userId, botId].sort().join(':');
      let [conv] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.directKey, directKey))
        .limit(1);

      if (!conv) {
        const nowTs = Date.now();
        const isoNow = new Date(nowTs).toISOString();
        const convId = `conv-${nowTs}-${crypto.randomBytes(3).toString('hex')}`;
        await db.transaction(async (tx) => {
          await tx.insert(conversationsTable).values({
            id: convId,
            directKey,
            title: bot.displayName,
            avatarUrl: bot.avatarUrl,
            lastMessage: '/start',
            lastMessageTime: isoNow,
            unreadCount: 0,
            isOnline: true,
            isPinned: false,
            isMuted: false,
            isGroup: false,
            sortTs: nowTs,
          });
          await tx.insert(conversationMembersTable).values([
            { conversationId: convId, userId: authReq.auth!.userId, role: 'member', unreadCount: 0 },
            { conversationId: convId, userId: botId, role: 'bot', unreadCount: 0 },
          ]);
        });
        [conv] = await db
          .select()
          .from(conversationsTable)
          .where(eq(conversationsTable.id, convId))
          .limit(1);
      }

      await db
        .insert(botChatStateTable)
        .values({
          botId,
          userId: authReq.auth!.userId,
          conversationId: conv!.id,
          startedAt: new Date(),
          blockedAt: null,
        })
        .onConflictDoUpdate({
          target: [botChatStateTable.botId, botChatStateTable.userId],
          set: {
            conversationId: conv!.id,
            startedAt: new Date(),
            blockedAt: null,
          },
        });

      await routeUserMessageToBots({
        actorId: authReq.auth!.userId,
        conversationId: conv!.id,
        messageId: `msg-start-${Date.now()}`,
        text: '/start',
      });

      res.json({ ok: true, conversationId: conv!.id });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/bots/:botId/block', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const botId = String(req.params.botId);
      const db = getDb();

      await db
        .insert(botChatStateTable)
        .values({
          botId,
          userId: authReq.auth!.userId,
          blockedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [botChatStateTable.botId, botChatStateTable.userId],
          set: { blockedAt: new Date() },
        });

      if (botId !== BOT_FACTORY_ID) {
        await enqueueBotUpdate(botId, {
          my_chat_member: {
            chat: { id: authReq.auth!.userId, type: 'private' },
            from: { id: authReq.auth!.userId },
            date: Math.floor(Date.now() / 1000),
            old_chat_member: { status: 'member' },
            new_chat_member: { status: 'kicked' },
          },
        });
      }

      res.json({ ok: true, blocked: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/bots/:botId/rotate-token', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const botId = String(req.params.botId);
      const db = getDb();

      const [bot] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.id, botId), eq(usersTable.kind, 'bot')))
        .limit(1);

      if (!bot || bot.ownerId !== authReq.auth!.userId) {
        sendApiError(res, 403, 'forbidden', 'لا تملك صلاحية إدارة هذا البوت');
        return;
      }

      const rawToken = await issueBotToken(botId, true);
      res.json({ ok: true, token: rawToken });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/conversations/:id/callback-query',
    requireAuth,
    validateBody(CallbackQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const conversationId = String(req.params.id);
        const { messageId, data } = req.body as { messageId: string; data: string };
        const db = getDb();

        const [member] = await db
          .select()
          .from(conversationMembersTable)
          .where(
            and(
              eq(conversationMembersTable.conversationId, conversationId),
              eq(conversationMembersTable.userId, authReq.auth!.userId)
            )
          )
          .limit(1);

        if (!member) {
          sendApiError(res, 404, 'not_found', 'المحادثة غير موجودة');
          return;
        }

        const [msg] = await db
          .select()
          .from(messagesTable)
          .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, conversationId)))
          .limit(1);

        if (!msg) {
          sendApiError(res, 404, 'not_found', 'الرسالة غير موجودة');
          return;
        }

        const botId = msg.senderId;
        if (botId === BOT_FACTORY_ID) {
          await handleBotFactoryInteraction({
            actorId: authReq.auth!.userId,
            conversationId,
            text: data,
            callbackData: data,
          });
          res.json({ ok: true, callbackQueryId: `cq-${crypto.randomUUID().slice(0, 8)}` });
          return;
        }

        const cqId = `cq-${crypto.randomUUID()}`;
        callbackQueryTargets.set(cqId, {
          userId: authReq.auth!.userId,
          conversationId,
          botId,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        await enqueueBotUpdate(botId, {
          callback_query: {
            id: cqId,
            from: {
              id: authReq.auth!.userId,
              username: authReq.auth!.userRow.handle ?? authReq.auth!.userRow.username,
              first_name: authReq.auth!.userRow.displayName,
            },
            message: {
              message_id: msg.id,
              chat: { id: conversationId },
              text: msg.text,
            },
            data,
          },
        });

        res.json({ ok: true, callbackQueryId: cqId });
      } catch (err) {
        next(err);
      }
    }
  );

  // 2. HTTP Bot API: POST /api/bot/v1/:method (Authorization: Bot <token>)
  app.post('/api/bot/v1/:method', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = String(req.headers.authorization ?? '');
      const rawToken = authHeader.startsWith('Bot ') ? authHeader.slice(4).trim() : '';
      const bot = rawToken ? await authenticateBotToken(rawToken) : null;
      if (!bot) {
        res.status(401).json({ ok: false, error_code: 401, description: 'Unauthorized' });
        return;
      }
      await handleBotApiMethod(bot, String(req.params.method), (req.body ?? {}) as Record<string, unknown>, res);
    } catch (err) {
      const apiErr = err as { status?: number; description?: string };
      if (apiErr.status && apiErr.description) {
        res.status(apiErr.status).json({ ok: false, error_code: apiErr.status, description: apiErr.description });
        return;
      }
      if (err instanceof SsrfError) {
        res.status(400).json({ ok: false, error_code: 400, description: err.message });
        return;
      }
      next(err);
    }
  });

  // 3. Telegram-style path Bot API: POST /bot<token>/<method>
  app.post(/^\/bot([^/]+)\/([A-Za-z0-9_]+)$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const match = req.path.match(/^\/bot([^/]+)\/([A-Za-z0-9_]+)$/);
      const rawToken = match?.[1] ? decodeURIComponent(match[1]) : '';
      const method = match?.[2] ?? '';
      const bot = rawToken ? await authenticateBotToken(rawToken) : null;
      if (!bot) {
        res.status(401).json({ ok: false, error_code: 401, description: 'Unauthorized' });
        return;
      }
      await handleBotApiMethod(bot, method, (req.body ?? {}) as Record<string, unknown>, res);
    } catch (err) {
      const apiErr = err as { status?: number; description?: string };
      if (apiErr.status && apiErr.description) {
        res.status(apiErr.status).json({ ok: false, error_code: apiErr.status, description: apiErr.description });
        return;
      }
      if (err instanceof SsrfError) {
        res.status(400).json({ ok: false, error_code: 400, description: err.message });
        return;
      }
      next(err);
    }
  });
}
