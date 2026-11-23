import process from 'node:process';

const BASE_URL = (process.env.TAWASUL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN environment variable');
  process.exit(1);
}

async function botApi(method, body = {}) {
  const res = await fetch(`${BASE_URL}/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  const me = await botApi('getMe');
  console.log('Reminder bot ready:', me.result?.username);

  await botApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'بدء التذكير' },
      { command: 'remind', description: 'تذكير بعد ١٠ ثوانٍ: /remind النص' },
    ],
  });

  let offset = 0;
  while (true) {
    try {
      const res = await botApi('getUpdates', { offset, timeout: 25 });
      for (const u of res.result || []) {
        offset = Math.max(offset, Number(u.update_id) + 1);
        const msg = u.message;
        if (!msg) continue;
        const chatId = msg.chat.id;
        const text = String(msg.text || '').trim();

        if (text === '/start') {
          await botApi('sendMessage', {
            chat_id: chatId,
            text: 'أرسل /remind <النص> وسأذكرك به بعد ١٠ ثوانٍ!',
          });
        } else if (text.startsWith('/remind')) {
          const note = text.slice('/remind'.length).trim() || 'موعدك الآن!';
          await botApi('sendMessage', {
            chat_id: chatId,
            text: `تم ضبط التذكير: «${note}» بعد ١٠ ثوانٍ.`,
          });
          setTimeout(() => {
            void botApi('sendMessage', {
              chat_id: chatId,
              text: `تذكير: ${note}`,
            });
          }, 10_000);
        }
      }
    } catch (err) {
      console.error('Reminder polling error:', err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

void main();
