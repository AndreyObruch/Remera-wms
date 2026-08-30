// api/max.js — ЗОНД MAX API (этап 2, правильные эндпоинты)
// Базовый домен MAX: platform-api2.max.ru
// Авторизация: заголовок Authorization (не query-параметр)
// Вебхук: POST /subscriptions
// Отправка: POST /messages

const BASE = 'https://platform-api2.max.ru';

export default async function handler(req, res) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'MAX_BOT_TOKEN not configured in Vercel Env' });
  }

  const results = {};

  // 1) Кто я: GET /me с заголовком Authorization
  try {
    const me = await fetch(`${BASE}/me`, {
      headers: { 'Authorization': token }
    });
    results.me = { status: me.status, body: await me.text() };
  } catch (e) {
    results.me = { error: e.message };
  }

  // 2) Проверка подписки: GET /subscriptions
  try {
    const subs = await fetch(`${BASE}/subscriptions`, {
      headers: { 'Authorization': token }
    });
    results.subscriptions = { status: subs.status, body: await subs.text() };
  } catch (e) {
    results.subscriptions = { error: e.message };
  }

  res.status(200).json(results);
}