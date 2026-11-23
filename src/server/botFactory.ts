import crypto from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  botChatStateTable,
  botCommandsTable,
  botTokensTable,
  conversationsTable,
  conversationMembersTable,
  mediaTable,
  messagesTable,
  usersTable,
} from '../db/schema.ts';
import { validateHandle } from './phone.ts';
import { emitUserEvent } from './events.ts';
import type { BotReplyMarkup } from '../types/index.ts';

export const BOT_FACTORY_ID = 'bot-botfactory';

interface WizardState {
  step:
    | 'newbot:name'
    | 'newbot:handle'
    | 'setname:text'
    | 'setdescription:text'
    | 'setabouttext:text'
    | 'setcommands:text'
    | 'setuserpic:media'
    | 'deletebot:confirm';
  botId?: string;
  displayName?: string;
}

function hashTokenSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export async function issueBotToken(botId: string, revokeExisting = true): Promise<string> {
  const db = getDb();
  const secret = crypto.randomBytes(24).toString('base64url');
  const secretHash = hashTokenSecret(secret);
  const prefix = secret.slice(0, 8);
  const tokenId = `btok-${crypto.randomUUID()}`;

  await db.transaction(async (tx) => {
    if (revokeExisting) {
      await tx
        .update(botTokensTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(botTokensTable.botId, botId), sql`${botTokensTable.revokedAt} IS NULL`));
    }
    await tx.insert(botTokensTable).values({
      id: tokenId,
      botId,
      secretHash,
      prefix,
    });
  });

  return `${botId}:${secret}`;
}

async function sendFactoryReply(
  conversationId: string,
  recipientUserId: string,
  text: string,
  replyMarkup?: BotReplyMarkup
): Promise<void> {
  const db = getDb();
  const msgId = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const nowTs = Date.now();
  const isoNow = new Date(nowTs).toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(messagesTable).values({
      id: msgId,
      conversationId,
      senderId: BOT_FACTORY_ID,
      text,
      timestamp: isoNow,
      isOwn: false,
      kind: 'text',
      status: 'delivered',
      replyMarkupJson: (replyMarkup ?? null) as Record<string, unknown> | null,
      sortTs: nowTs,
    });

    await tx
      .update(conversationsTable)
      .set({
        lastMessage: text.split('\n')[0]?.slice(0, 120) || 'رسالة من مصنع البوتات',
        lastMessageTime: isoNow,
        sortTs: nowTs,
      })
      .where(eq(conversationsTable.id, conversationId));

    await tx
      .update(conversationMembersTable)
      .set({ unreadCount: sql`${conversationMembersTable.unreadCount} + 1` })
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, recipientUserId)
        )
      );
  });

  await emitUserEvent(recipientUserId, 'message:new', {
    conversationId,
    message: {
      id: msgId,
      senderId: BOT_FACTORY_ID,
      text,
      timestamp: isoNow,
      isOwn: false,
      kind: 'text',
      status: 'delivered',
      replyMarkup,
    },
  });
}

async function getWizardState(userId: string): Promise<WizardState | null> {
  const db = getDb();
  const [row] = await db
    .select({ wizardStateJson: botChatStateTable.wizardStateJson })
    .from(botChatStateTable)
    .where(and(eq(botChatStateTable.botId, BOT_FACTORY_ID), eq(botChatStateTable.userId, userId)))
    .limit(1);
  return (row?.wizardStateJson as WizardState | null) ?? null;
}

async function setWizardState(
  userId: string,
  conversationId: string,
  state: WizardState | null
): Promise<void> {
  const db = getDb();
  await db
    .insert(botChatStateTable)
    .values({
      botId: BOT_FACTORY_ID,
      userId,
      conversationId,
      startedAt: new Date(),
      wizardStateJson: state as unknown as Record<string, unknown> | null,
    })
    .onConflictDoUpdate({
      target: [botChatStateTable.botId, botChatStateTable.userId],
      set: {
        conversationId,
        startedAt: sql`COALESCE(${botChatStateTable.startedAt}, NOW())`,
        blockedAt: null,
        wizardStateJson: state as unknown as Record<string, unknown> | null,
      },
    });
}

async function listOwnerBots(ownerId: string) {
  const db = getDb();
  return db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.ownerId, ownerId),
        eq(usersTable.kind, 'bot'),
        eq(usersTable.status, 'active')
      )
    );
}

async function resolveSelectedOrTargetBot(
  ownerId: string,
  arg: string | undefined,
  wizardState: WizardState | null
) {
  const bots = await listOwnerBots(ownerId);
  if (arg) {
    const clean = arg.replace(/^@/, '').trim().toLowerCase();
    return bots.find((b) => (b.handle ?? b.username).toLowerCase() === clean) ?? null;
  }
  if (wizardState?.botId) {
    return bots.find((b) => b.id === wizardState.botId) ?? null;
  }
  return bots.length === 1 ? bots[0]! : null;
}

export async function handleBotFactoryInteraction(input: {
  actorId: string;
  conversationId: string;
  text: string;
  mediaId?: string;
  callbackData?: string;
}): Promise<void> {
  const db = getDb();
  const raw = (input.callbackData ?? input.text ?? '').trim();
  const [cmdRaw, ...restParts] = raw.split(/\s+/);
  const cmd = (cmdRaw ?? '').toLowerCase();
  const arg = restParts.join(' ').trim();
  const wizard = await getWizardState(input.actorId);

  if (cmd === '/cancel' || cmd === 'bf:cancel') {
    await setWizardState(input.actorId, input.conversationId, null);
    await sendFactoryReply(input.conversationId, input.actorId, 'تم إلغاء العملية الحالية.');
    return;
  }

  if (cmd === '/start' || cmd === '/help') {
    await setWizardState(input.actorId, input.conversationId, null);
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      [
        'أهلاً بك في مصنع البوتات (@botfactory_bot)!',
        'يمكنك إنشاء وإدارة بوتاتك على منصة تواصل عبر الأوامر التالية:',
        '• /newbot — إنشاء بوت جديد',
        '• /mybots — عرض وإدارة بوتاتك',
        '• /token — إصدار أو تجديد توكن البوت',
        '• /setname — تغيير اسم البوت',
        '• /setdescription — تعديل الوصف الطويل للبوت',
        '• /setabouttext — تعديل النبذة المختصرة',
        '• /setuserpic — تعيين صورة البوت',
        '• /setcommands — ضبط قائمة أوامر البوت',
        '• /setprivacy — تبديل وضع الخصوصية في المجموعات',
        '• /deletebot — حذف البوت',
      ].join('\n'),
      {
        inline_keyboard: [
          [
            { text: 'إنشاء بوت جديد', callback_data: '/newbot' },
            { text: 'بوتاتي', callback_data: '/mybots' },
          ],
        ],
      }
    );
    return;
  }

  if (cmd === '/newbot' || cmd === '/بوت_جديد') {
    const [owner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, input.actorId))
      .limit(1);

    if (!owner || !owner.phoneVerifiedAt) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'يجب توثيق رقم هاتفك أولاً قبل إنشاء بوت.'
      );
      return;
    }

    const ageMs = Date.now() - owner.createdAt.getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'للحماية من السبام، يجب أن يكون حسابك موثّقاً ومضى على إنشائه ٢٤ ساعة على الأقل لإنشاء بوت.'
      );
      return;
    }

    const existingBots = await listOwnerBots(input.actorId);
    if (existingBots.length >= 5) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'بلغت الحد الأقصى المسموح به (٥ بوتات لكل حساب). احذف بوتاً قديماً أولاً.'
      );
      return;
    }

    await setWizardState(input.actorId, input.conversationId, { step: 'newbot:name' });
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      'حسناً، لننشئ بوتاً جديداً! أرسل الآن الاسم الظاهر للبوت (مثال: بوت الأخبار العراقي):'
    );
    return;
  }

  if (cmd === '/mybots') {
    const bots = await listOwnerBots(input.actorId);
    if (bots.length === 0) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'لا تملك أي بوتات بعد. اضغط على «إنشاء بوت جديد» أو أرسل /newbot.',
        {
          inline_keyboard: [[{ text: 'إنشاء بوت جديد', callback_data: '/newbot' }]],
        }
      );
      return;
    }
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      `لديك ${bots.length} بوتات نشطة. اختر بوتاً لإدارته:`,
      {
        inline_keyboard: bots.map((b) => [
          { text: `${b.displayName} (@${b.handle ?? b.username})`, callback_data: `bf:bot:${b.id}` },
        ]),
      }
    );
    return;
  }

  if (raw.startsWith('bf:bot:')) {
    const botId = raw.slice('bf:bot:'.length).trim();
    const bots = await listOwnerBots(input.actorId);
    const bot = bots.find((b) => b.id === botId);
    if (!bot) {
      await sendFactoryReply(input.conversationId, input.actorId, 'لم يتم العثور على هذا البوت.');
      return;
    }
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      `إدارة البوت: ${bot.displayName} (@${bot.handle ?? bot.username})\nوضع الخصوصية: ${
        bot.botPrivacyMode ? 'مفعّل' : 'معطّل'
      }`,
      {
        inline_keyboard: [
          [
            { text: 'تجديد التوكن', callback_data: `/token @${bot.handle ?? bot.username}` },
            { text: 'وضع الخصوصية', callback_data: `/setprivacy @${bot.handle ?? bot.username}` },
          ],
          [
            { text: 'تغيير الاسم', callback_data: `/setname @${bot.handle ?? bot.username}` },
            { text: 'تعيين الأوامر', callback_data: `/setcommands @${bot.handle ?? bot.username}` },
          ],
          [
            { text: 'حذف البوت', callback_data: `/deletebot @${bot.handle ?? bot.username}` },
          ],
        ],
      }
    );
    return;
  }

  if (cmd === '/token') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'حدد معرف البوت مع الأمر: /token @my_bot'
      );
      return;
    }
    const rawToken = await issueBotToken(bot.id, true);
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      `تم إصدار توكن جديد للبوت @${bot.handle ?? bot.username} (التوكن السابق تم إبطاله):\n${rawToken}`
    );
    return;
  }

  if (cmd === '/setprivacy') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'حدد معرف البوت: /setprivacy @my_bot'
      );
      return;
    }
    const nextPrivacy = !bot.botPrivacyMode;
    await db
      .update(usersTable)
      .set({ botPrivacyMode: nextPrivacy })
      .where(eq(usersTable.id, bot.id));
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      `تم تحديث وضع الخصوصية للبوت @${bot.handle ?? bot.username} إلى: ${
        nextPrivacy ? 'مفعّل (يستلم الأوامر والإشارات فقط)' : 'معطّل (يستلم كل رسائل المجموعة)'
      }.`
    );
    return;
  }

  if (cmd === '/setname') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(input.conversationId, input.actorId, 'حدد البوت أولاً: /setname @my_bot');
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'setname:text',
      botId: bot.id,
    });
    await sendFactoryReply(input.conversationId, input.actorId, 'أرسل الاسم الجديد للبوت:');
    return;
  }

  if (cmd === '/setdescription') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'حدد البوت أولاً: /setdescription @my_bot'
      );
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'setdescription:text',
      botId: bot.id,
    });
    await sendFactoryReply(input.conversationId, input.actorId, 'أرسل الوصف الجديد للبوت:');
    return;
  }

  if (cmd === '/setabouttext') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'حدد البوت أولاً: /setabouttext @my_bot'
      );
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'setabouttext:text',
      botId: bot.id,
    });
    await sendFactoryReply(input.conversationId, input.actorId, 'أرسل النبذة المختصرة الجديدة للبوت:');
    return;
  }

  if (cmd === '/setuserpic') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(input.conversationId, input.actorId, 'حدد البوت أولاً: /setuserpic @my_bot');
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'setuserpic:media',
      botId: bot.id,
    });
    await sendFactoryReply(input.conversationId, input.actorId, 'أرفق الصورة الجديدة للبوت الآن:');
    return;
  }

  if (cmd === '/setcommands') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(input.conversationId, input.actorId, 'حدد البوت أولاً: /setcommands @my_bot');
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'setcommands:text',
      botId: bot.id,
    });
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      'أرسل قائمة الأوامر بصيغة سطر لكل أمر:\ncommand - الوصف\nمثال:\nstart - بدء البوت\nhelp - المساعدة'
    );
    return;
  }

  if (cmd === '/deletebot') {
    const bot = await resolveSelectedOrTargetBot(input.actorId, arg || undefined, wizard);
    if (!bot) {
      await sendFactoryReply(input.conversationId, input.actorId, 'حدد البوت أولاً: /deletebot @my_bot');
      return;
    }
    await setWizardState(input.actorId, input.conversationId, {
      step: 'deletebot:confirm',
      botId: bot.id,
    });
    await sendFactoryReply(
      input.conversationId,
      input.actorId,
      `هل أنت متأكد من حذف @${bot.handle ?? bot.username} نهائياً؟ أرسل «نعم احذف» للتأكيد أو /cancel للإلغاء.`
    );
    return;
  }

  // Interactive wizard step handling
  if (wizard) {
    if (wizard.step === 'newbot:name') {
      const displayName = raw.slice(0, 60);
      if (displayName.length < 2) {
        await sendFactoryReply(input.conversationId, input.actorId, 'الاسم قصير جداً، جرّب اسماً آخر.');
        return;
      }
      await setWizardState(input.actorId, input.conversationId, {
        step: 'newbot:handle',
        displayName,
      });
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        'ممتاز! الآن اختر معرفاً للبوت بالإنكليزية ينتهي بـ _bot (مثال: baghdad_news_bot):'
      );
      return;
    }

    if (wizard.step === 'newbot:handle') {
      const check = validateHandle(raw.replace(/^@/, ''), { isBot: true });
      if (!check.ok) {
        await sendFactoryReply(input.conversationId, input.actorId, check.message);
        return;
      }

      const [dup] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(or(eq(usersTable.handle, check.handle), eq(usersTable.username, check.handle)))
        .limit(1);

      if (dup) {
        await sendFactoryReply(
          input.conversationId,
          input.actorId,
          'هذا المعرف محجوز بالفعل، اختر معرفاً آخر ينتهي بـ _bot:'
        );
        return;
      }

      const botId = `bot-${crypto.randomUUID().slice(0, 12)}`;
      await db.insert(usersTable).values({
        id: botId,
        username: check.handle,
        handle: check.handle,
        displayName: wizard.displayName ?? check.handle,
        avatarUrl: '/seed/avatar-1.svg',
        bio: 'بوت تفاعلي على منصة تواصل',
        province: 'بغداد',
        isVerified: false,
        verifiedKind: 'none',
        accountType: 'creator',
        role: 'user',
        kind: 'bot',
        status: 'active',
        ownerId: input.actorId,
        botShortDescription: 'بوت تفاعلي',
        botDescription: 'بوت مبني عبر مصنع البوتات',
        botPrivacyMode: true,
        botCanJoinGroups: true,
        botIsListed: true,
        sortOrder: 200,
      });

      const rawToken = await issueBotToken(botId, false);
      await setWizardState(input.actorId, input.conversationId, null);

      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        [
          `تم إنشاء البوت @${check.handle} بنجاح!`,
          `استخدم هذا التوكن للاتصال بواجهة Bot API (احفظه الآن ولا تشاركه):`,
          rawToken,
        ].join('\n')
      );
      return;
    }

    if (wizard.step === 'setname:text' && wizard.botId) {
      await db
        .update(usersTable)
        .set({ displayName: raw.slice(0, 60) })
        .where(and(eq(usersTable.id, wizard.botId), eq(usersTable.ownerId, input.actorId)));
      await setWizardState(input.actorId, input.conversationId, null);
      await sendFactoryReply(input.conversationId, input.actorId, 'تم تحديث اسم البوت.');
      return;
    }

    if (wizard.step === 'setdescription:text' && wizard.botId) {
      await db
        .update(usersTable)
        .set({ botDescription: raw.slice(0, 500) })
        .where(and(eq(usersTable.id, wizard.botId), eq(usersTable.ownerId, input.actorId)));
      await setWizardState(input.actorId, input.conversationId, null);
      await sendFactoryReply(input.conversationId, input.actorId, 'تم تحديث الوصف.');
      return;
    }

    if (wizard.step === 'setabouttext:text' && wizard.botId) {
      await db
        .update(usersTable)
        .set({ botShortDescription: raw.slice(0, 140), bio: raw.slice(0, 140) })
        .where(and(eq(usersTable.id, wizard.botId), eq(usersTable.ownerId, input.actorId)));
      await setWizardState(input.actorId, input.conversationId, null);
      await sendFactoryReply(input.conversationId, input.actorId, 'تم تحديث النبذة المختصرة.');
      return;
    }

    if (wizard.step === 'setuserpic:media' && wizard.botId) {
      if (!input.mediaId) {
        await sendFactoryReply(input.conversationId, input.actorId, 'يرجى إرفاق صورة صالحة أو أرسل /cancel.');
        return;
      }
      const [media] = await db
        .select()
        .from(mediaTable)
        .where(and(eq(mediaTable.id, input.mediaId), eq(mediaTable.ownerId, input.actorId)))
        .limit(1);

      if (!media || media.status !== 'ready' || !media.publicUrl) {
        await sendFactoryReply(input.conversationId, input.actorId, 'الصورة غير جاهزة أو غير صالحة.');
        return;
      }
      await db
        .update(usersTable)
        .set({ avatarUrl: media.publicUrl, botAvatarMediaId: media.id })
        .where(and(eq(usersTable.id, wizard.botId), eq(usersTable.ownerId, input.actorId)));
      await setWizardState(input.actorId, input.conversationId, null);
      await sendFactoryReply(input.conversationId, input.actorId, 'تم تحديث صورة البوت بنجاح.');
      return;
    }

    if (wizard.step === 'setcommands:text' && wizard.botId) {
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed: Array<{ command: string; description: string }> = [];
      for (const line of lines.slice(0, 50)) {
        const idx = line.indexOf('-');
        if (idx <= 0) continue;
        const c = line.slice(0, idx).trim().replace(/^\//, '').toLowerCase();
        const d = line.slice(idx + 1).trim();
        if (/^[a-z0-9_]{1,32}$/.test(c) && d.length > 0) {
          parsed.push({ command: c, description: d.slice(0, 256) });
        }
      }
      if (parsed.length === 0) {
        await sendFactoryReply(
          input.conversationId,
          input.actorId,
          'لم يتم التعرف على أوامر صالحة. استخدم الصيغة: command - الوصف'
        );
        return;
      }
      await db.transaction(async (tx) => {
        await tx.delete(botCommandsTable).where(eq(botCommandsTable.botId, wizard.botId!));
        await tx.insert(botCommandsTable).values(
          parsed.map((p, i) => ({
            id: `bcmd-${crypto.randomUUID().slice(0, 10)}`,
            botId: wizard.botId!,
            command: p.command,
            description: p.description,
            sortOrder: i,
          }))
        );
      });
      await setWizardState(input.actorId, input.conversationId, null);
      await sendFactoryReply(
        input.conversationId,
        input.actorId,
        `تم حفظ ${parsed.length} أوامر للبوت بنجاح.`
      );
      return;
    }

    if (wizard.step === 'deletebot:confirm' && wizard.botId) {
      if (raw === 'نعم احذف') {
        await db.transaction(async (tx) => {
          await tx
            .update(usersTable)
            .set({ status: 'deleted', deletedAt: new Date() })
            .where(and(eq(usersTable.id, wizard.botId!), eq(usersTable.ownerId, input.actorId)));
          await tx
            .update(botTokensTable)
            .set({ revokedAt: new Date() })
            .where(eq(botTokensTable.botId, wizard.botId!));
        });
        await setWizardState(input.actorId, input.conversationId, null);
        await sendFactoryReply(input.conversationId, input.actorId, 'تم حذف البوت وإبطال مفاتيحه بنجاح.');
      } else {
        await sendFactoryReply(input.conversationId, input.actorId, 'أرسل «نعم احذف» للتأكيد أو /cancel للإلغاء.');
      }
      return;
    }
  }

  await sendFactoryReply(
    input.conversationId,
    input.actorId,
    'لم أفهم هذا الطلب. أرسل /start لعرض قائمة الأوامر.'
  );
}
