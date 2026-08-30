// api/max.js — ЗОНД MAX API (этап 1)
// Прежде чем писать боевой шлюз, узнаём реальный формат API:
// кто я (me) и какой метод подписки вебхука принимает MAX.

const BASE = 'https://botapi.max.ru';

export default async function handler(req, res) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'MAX_BOT_TOKEN not configured in Vercel Env' });
  }

  const results = {};

  // 1) Кто я: проверяем токен и получаем данные бота
  try {
    const me = await fetch(`${BASE}/me?token=${token}`);
    results.me = { status: me.status, body: await me.text() };
  } catch (e) {
    results.me = { error: e.message };
  }

  // 2) Пробуем варианты подписки вебхука (только по ?subscribe=1)
  if (req.query.subscribe === '1') {
    const url = 'https://remera-wms-bvii.vercel.app/api/max';
    for (const method of ['subscribeWebhook', 'setWebhook', 'webhook/subscribe']) {
      try {
        const r = await fetch(`${BASE}/${method}?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, secret: 'remera-max-wh-2026' })
        });
        results[method] = { status: r.status, body: await r.text() };
      } catch (e) {
        results[method] = { error: e.message };
      }
    }
  }

  res.status(200).json(results);
}