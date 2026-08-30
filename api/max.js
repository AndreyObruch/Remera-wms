// api/max.js — ЗОНД MAX API v3 (с подпиской вебхука)
// Секрет пока не используем (он optional в MAX API) — добавим в боевом коде.

const BASE = 'https://platform-api2.max.ru';

export default async function handler(req, res) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'MAX_BOT_TOKEN not configured' });

  const results = {};

  // 1) Кто я
  try {
    const me = await fetch(`${BASE}/me`, { headers: { Authorization: token } });
    results.me = { status: me.status, body: await me.text() };
  } catch (e) { results.me = { error: e.message }; }

  // 2) Текущие подписки
  try {
    const subs = await fetch(`${BASE}/subscriptions`, { headers: { Authorization: token } });
    results.subscriptions = { status: subs.status, body: await subs.text() };
  } catch (e) { results.subscriptions = { error: e.message }; }

  // 3) Если ?subscribe=1 — подписать вебхук (без секрета)
  if (req.query.subscribe === '1') {
    const url = 'https://remera-wms-bvii.vercel.app/api/max';
    try {
      const r = await fetch(`${BASE}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          update_types: ['message_created', 'bot_started']
        })
      });
      results.subscribe = { status: r.status, body: await r.text() };
    } catch (e) { results.subscribe = { error: e.message }; }
  }

  res.status(200).json(results);
}