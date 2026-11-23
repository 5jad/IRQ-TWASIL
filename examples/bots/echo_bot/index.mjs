import process from 'node:process';

const BASE_URL = (process.env.TAWASUL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN environment variable');
  process.exit(1);
}

async function botApi(method, body = {}) {
  const res = await fetch(`${BASE_URL}/api/bot/v1/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`${method} failed: ${json.description || res.status}`);
  }
  return json.result;
}

async function main() {
  const me = await botApi('getMe');
  console.log(`Echo bot online: @${me.username} (${me.id})`);

  await botApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'بدء المحادثة مع بوت الصدى' },
      { command: 'ping', description: 'فحص استجابة البوت' },
    ],
  });

  let offset = 0;
  while (true) {
    try {
      const updates = await botApi('getUpdates', { offset, timeout: 25 });
      for (const u of updates) {
        offset = Math.max(offset, Number(u.update_id) + 1);
        if (u.message) {
          const chatId = u.message.chat.id;
          const text = String(u.message.text || '').trim();
          const reply =
            text === '/start'
              ? 'أهلاً بك! أرسل أي رسالة وسأعيدها لك فوراً.'
              : text === '/ping'
              ? 'بونغ!'
              : `صدى: ${text}`;

          await botApi('sendMessage', {
            chat_id: chatId,
            text: reply,
            reply_markup: {
              inline_keyboard: [[{ text: 'اختبار زر', callback_data: 'echo_btn' }]],
            },
          });
        } else if (u.callback_query) {
          await botApi('answerCallbackQuery', {
            callback_query_id: u.callback_query.id,
            text: 'تم استلام ضغطة الزر بنجاح!',
            show_alert: false,
          });
        }
      }
    } catch (err) {
      console.error('Polling error:', err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

void main();
