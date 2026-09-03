// api/chat.js — WMS «РЕМЕРА» v2: внутренний чат организации (v2 с детальным логом).
import { checkPin, isCommand, processCommand } from '../lib/core.js';
import { withState, loadState, uid } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return await postChat(req, res);
    if (req.method === 'GET') return await getChat(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[chat handler] fatal:', e.message, e.stack);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + e.message });
  }
}

async function postChat(req, res) {
  console.log('[postChat] start');
  
  const pin = (req.body || {}).pin;
  console.log('[postChat] pin received:', pin ? 'yes' : 'no');
  
  const user = checkPin(pin);
  console.log('[postChat] checkPin result:', user ? user.role : 'null');
  
  if (!user) return res.status(401).json({ error: 'Неверный PIN' });

  const clean = String((req.body || {}).text || '').trim().slice(0, 2000);
  console.log('[postChat] text:', clean);
  
  if (!clean) return res.status(400).json({ error: 'Пустое сообщение' });

  const now = Date.now();
  let replyText = null;

  try {
    await withState((state) => {
      console.log('[withState] inside callback, state.messages.length:', state.messages.length);
      
      // 1) сообщение автора в ленту
      state.messages.push({
        id: uid(), ts: now, role: user.role, author: user.name,
        text: clean, kind: isCommand(clean) ? 'cmd' : 'msg',
      });
      console.log('[withState] pushed user message');

      // 2) команда → ответ системы + запись в очередь проводок
      if (isCommand(clean)) {
        console.log('[withState] is command, calling processCommand');
        const r = processCommand(clean);
        console.log('[withState] processCommand returned:', r.text.slice(0, 50));
        replyText = r.text;
        state.messages.push({
          id: uid(), ts: now + 1, role: 'system', author: 'WMS',
          text: r.text, kind: 'reply',
        });
        console.log('[withState] pushed system reply');
        if (r.movement) {
          state.pending.push({
            id: uid(), ts: now, author: user.name, role: user.role,
            ...r.movement, status: 'pending',
          });
          console.log('[withState] pushed pending movement');
        }
      }
      console.log('[withState] callback finished');
    });
    console.log('[postChat] withState completed');
  } catch (e) {
    console.error('[postChat] withState error:', e.message, e.stack);
    return res.status(500).json({ error: 'Ошибка записи: ' + e.message });
  }

  console.log('[postChat] returning ok');
  return res.status(200).json({ ok: true, reply: replyText });
}

async function getChat(req, res) {
  console.log('[getChat] start');
  
  const pin = req.query.pin;
  console.log('[getChat] pin:', pin ? 'yes' : 'no');
  
  const user = checkPin(pin);
  console.log('[getChat] checkPin result:', user ? user.role : 'null');
  
  if (!user) return res.status(401).json({ error: 'Неверный PIN' });

  const since = parseInt(req.query.since || '0', 10) || 0;
  console.log('[getChat] since:', since);
  
  try {
    const state = await loadState();
    console.log('[getChat] loadState ok, messages:', state.messages.length);

    const payload = {
      ok: true,
      serverTime: Date.now(),
      messages: state.messages.filter((m) => m.ts > since),
    };
    
    if (user.role === 'director') {
      payload.pending = state.pending.filter((p) => p.status === 'pending');
    }
    
    console.log('[getChat] returning payload');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('[getChat] error:', e.message, e.stack);
    return res.status(500).json({ error: 'Ошибка чтения: ' + e.message });
  }
}