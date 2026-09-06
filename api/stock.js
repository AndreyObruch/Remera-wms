// api/stock.js — Фаза Б: чтение остатков и журнала (директор, бухгалтер)
import { checkPin } from '../lib/core.js';
import { loadState } from '../lib/store.js';

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

    const state = await loadState();
    return res.status(200).json({
      ok: true,
      role: user.role,
      stock: state.stock || {},
      movements: (state.movements || []).slice(-100).reverse(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}