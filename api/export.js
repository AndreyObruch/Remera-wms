// api/export.js — Фаза 4b: выгрузка CSV из живого контура (директор, бухгалтер).
import { checkPin } from '../lib/core.js';
import { loadState } from '../lib/store.js';

const esc = (v) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const user = checkPin(req.query.pin);
    if (!user) return res.status(401).json({ error: 'Неверный PIN' });
    if (user.role !== 'director' && user.role !== 'accountant')
      return res.status(403).json({ error: 'Доступно директору и бухгалтеру' });

    const kind = req.query.kind === 'movements' ? 'movements' : 'stock';
    const state = await loadState();
    const lines = [];

    if (kind === 'stock') {
      lines.push('КОД;КОЛ');
      for (const [code, qty] of Object.entries(state.stock || {})) {
        lines.push(esc(code) + ';' + qty);
      }
    } else {
      lines.push('ДАТА;ОПЕРАЦИЯ;КОЛ-ВО;КОД;ОСТАТОК ПОСЛЕ;КТО');
      for (const m of (state.movements || [])) {
        const d = new Date(m.ts).toISOString().slice(0, 16).replace('T', ' ');
        const qty = (m.sign > 0 ? '+' : '-') + m.qty;
        lines.push([d, m.label, qty, m.code, m.next ?? '', m.decidedBy || m.author || ''].map(esc).join(';'));
      }
    }

    const csv = '\uFEFF' + lines.join('\r\n'); // BOM — чтобы Excel читал кириллицу
    const name = kind === 'stock' ? 'remera-stock.csv' : 'remera-movements.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}