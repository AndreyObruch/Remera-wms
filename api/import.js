// api/import.js — Фаза 4: импорт остатков из CSV (1С) в живой контур. Только директор.
import { checkPin, NOMENCLATURE } from '../lib/core.js';
import { withState, uid } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { pin, rows } = req.body || {};
    const user = checkPin(pin);
    if (!user) return res.status(401).json({ error: 'Неверный PIN' });
    if (user.role !== 'director') return res.status(403).json({ error: 'Только директор' });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'Пустой файл' });
    if (rows.length > 2000) return res.status(400).json({ error: 'Больше 2000 строк — разбейте файл' });

    const result = await withState((state) => {
      let applied = 0;
      const errors = [];
      for (const r of rows) {
        const code = String(r.code || '').trim().toUpperCase();
        const qty = Number(r.qty);
        if (!NOMENCLATURE[code]) { errors.push(code || '(нет кода)'); continue; }
        if (!isFinite(qty) || qty < 0) { errors.push(code + ': количество'); continue; }
        const prev = Number(state.stock[code] || 0);
        const delta = qty - prev;
        state.stock[code] = qty;
        state.movements.push({
          id: uid(), ts: Date.now(), op: 'import', label: 'Импорт CSV (1С)',
          type: 'import', sign: delta >= 0 ? 1 : -1, code, name: NOMENCLATURE[code],
          qty: Math.abs(delta), status: 'imported',
          decidedBy: user.name, decidedAt: Date.now(), prev, next: qty,
        });
        applied++;
      }
      state.messages.push({
        id: uid(), ts: Date.now() + 1, role: 'system', author: 'WMS',
        text: '📥 Импорт CSV: применено позиций — ' + applied +
          (errors.length ? ', пропущено с ошибками — ' + errors.length + ': ' + errors.slice(0, 5).join(', ') : ''),
        kind: 'reply',
      });
      return { ok: true, applied, errors };
    });

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}