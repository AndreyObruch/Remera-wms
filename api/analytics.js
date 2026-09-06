// api/analytics.js — Фаза 5a: точка заказа и прогноз закупок (живой контур).
// Порог: запаса меньше чем на 7 дней среднего расхода → позиция попадает отчёт.
import { checkPin, NOMENCLATURE, DAILY_NORM } from '../lib/core.js';
import { loadState } from '../lib/store.js';

const HORIZON_DAYS = 7;

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
    const rows = [];
    for (const [code, stock] of Object.entries(state.stock || {})) {
      const norm = DAILY_NORM[code];
      if (!norm || norm <= 0) continue;
      const daysLeft = stock / norm;
      if (daysLeft > HORIZON_DAYS) continue;
      const recommended = Math.max(Math.ceil(norm * 14 - stock), 0); // дозакупка до 2 недель
      rows.push({
        code,
        name: NOMENCLATURE[code] || code,
        stock,
        norm,
        daysLeft: Math.floor(daysLeft * 10) / 10,
        recommended,
      });
    }
    rows.sort((a, b) => a.daysLeft - b.daysLeft);
    return res.status(200).json({ horizon: HORIZON_DAYS, rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}