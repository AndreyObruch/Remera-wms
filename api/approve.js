// api/approve.js — v3: идемпотентность (двойной клик без alert)
import { checkPin } from '../lib/core.js';
import { withState, uid } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { pin, id, action } = req.body || {};
    const user = checkPin(pin);
    if (!user) return res.status(401).json({ error: 'Неверный PIN' });
    if (user.role !== 'director') return res.status(403).json({ error: 'Только директор' });
    if (!id || !['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'Нет id или action' });

    const result = await withState((state) => {
      const idx = state.pending.findIndex((p) => p.id === id && p.status === 'pending');

      // Уже обработана (есть в журнале) — молча ok, без alert
      if (idx < 0) {
        const done = (state.movements || []).some((m) => m.id === id);
        if (done) return { ok: true, dup: true };
        return { ok: false, reason: 'not-found' };
      }

      const op = state.pending[idx];

      if (action === 'approve') {
        const prev = Number(state.stock[op.code] || 0);
        const next = prev + op.qty * op.sign;
        if (next < 0) return { ok: false, reason: 'stock-negative', code: op.code, prev };

        state.pending.splice(idx, 1);
        state.stock[op.code] = next;
        state.movements.push({
          id: uid(), ts: Date.now(), ...op,
          status: 'approved', decidedBy: user.name, decidedAt: Date.now(), prev, next,
        });
        state.messages.push({
          id: uid(), ts: Date.now() + 1, role: 'system', author: 'WMS',
          text: `✅ Проведено: ${op.label}\n• ${op.qty} × ${op.code}\n• Остаток: ${prev} → ${next}`,
          kind: 'reply',
        });
      } else {
        state.pending.splice(idx, 1);
        state.movements.push({
          id: uid(), ts: Date.now(), ...op,
          status: 'rejected', decidedBy: user.name, decidedAt: Date.now(),
        });
        state.messages.push({
          id: uid(), ts: Date.now() + 1, role: 'system', author: 'WMS',
          text: `❌ Отклонено: ${op.label}\n• ${op.qty} × ${op.code}`,
          kind: 'reply',
        });
      }
      return { ok: true };
    });

    if (!result.ok) {
      if (result.reason === 'not-found') return res.status(404).json({ error: 'Проводка не найдена' });
      if (result.reason === 'stock-negative')
        return res.status(400).json({ error: `Остаток ${result.code} ушёл бы в минус (${result.prev})` });
    }
    return res.status(200).json({ ok: true, dup: !!result.dup });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}