// api/chat.js — WMS «РЕМЕРА» v2: внутренний чат организации.
// POST — отправить сообщение/команду; GET — поллинг новых сообщений.
// Ни одного внешнего мессенджера: всё внутри проекта.
import { checkPin, isCommand, processCommand } from '../lib/core.js';
import { withState, loadState, uid } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return await postChat(req, res);
    if (req.method === 'GET') return await getChat(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('chat error:', e.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function postChat(req, res) {
  const user = checkPin((req.body || {}).pin);
  if (!user) return res.status(401).json({ error: 'Неверный PIN' });

  const clean = String((req.body || {}).text || '').trim().slice(0, 2000);
  if (!clean) return res.status(400).json({ error: 'Пустое сообщение' });

  const now = Date.now();
  let replyText = null;

  await withState((state) => {
    // 1) сообщение автора в ленту
    state.messages.push({
      id: uid(), ts: now, role: user.role, author: user.name,
      text: clean, kind: isCommand(clean) ? 'cmd' : 'msg',
    });

    // 2) команда → ответ системы + запись в очередь проводок
    if (isCommand(clean)) {
      const r = processCommand(clean);
      replyText = r.text;
      state.messages.push({
        id: uid(), ts: now + 1, role: 'system', author: 'WMS',
        text: r.text, kind: 'reply',
      });
      if (r.movement) {
        state.pending.push({
          id: uid(), ts: now, author: user.name, role: user.role,
          ...r.movement, status: 'pending',
        });
      }
    }
  });

  return res.status(200).json({ ok: true, reply: replyText });
}

async function getChat(req, res) {
  const user = checkPin(req.query.pin);
  if (!user) return res.status(401).json({ error: 'Неверный PIN' });

  const since = parseInt(req.query.since || '0', 10) || 0;
  const state = await loadState();

  const payload = {
    ok: true,
    serverTime: Date.now(),
    messages: state.messages.filter((m) => m.ts > since),
  };
  // Очередь проводок видит только директор
  if (user.role === 'director') {
    payload.pending = state.pending.filter((p) => p.status === 'pending');
  }
  return res.status(200).json(payload);
}