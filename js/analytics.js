/* ============================================================
   МОДУЛЬ: analytics.js
   ОТВЕТСТВЕННОСТЬ: Бизнес-логика — расчёт точки заказа (ROP),
   определение статуса позиции, прогноз дней до истощения
   ФИЗИКА ПРОЦЕССА: ROP = avg_daily × (lead_time + safety_stock_days)
   Это количество, при достижении которого нужно размещать заказ,
   чтобы сырьё успело доехать до истощения текущего остатка
   ============================================================ */

import { getDB } from './db.js';
import { getCurrentStock } from './data-layer.js';

/*
 * Расчёт точки заказа (Reorder Point)
 * Физика: ROP покрывает расход за время доставки + страховой запас
 * на случай волатильности спроса или задержки поставщика
 */
export function calcROP(articleId) {
  const db = getDB();
  const row = db.exec(`
    SELECT i.avg_daily_consumption, i.safety_stock_days, s.lead_time_days
    FROM items i
    LEFT JOIN item_suppliers isp ON isp.article_id = i.article_id AND isp.is_primary = 1
    LEFT JOIN suppliers s ON s.supplier_id = isp.supplier_id
    WHERE i.article_id = '${articleId}'
  `)[0];
  if (!row) return 0;
  const [avgDaily, safetyDays, leadTime] = row.values[0];
  return Math.round(avgDaily * ((leadTime || 0) + safetyDays));
}

/*
 * Определение статуса позиции: норма / внимание / критично
 * Физика: сравниваем текущий остаток с ROP и safety_stock.
 * Ниже safety_stock — критический дефицит (риск остановки конвейера).
 * Ниже ROP — пора заказывать (поставщик ещё успеет доставить).
 */
export function getStatus(articleId) {
  const stock = getCurrentStock(articleId);
  const rop = calcROP(articleId);
  const db = getDB();
  const safetyRow = db.exec(`
    SELECT avg_daily_consumption * safety_stock_days
    FROM items WHERE article_id = '${articleId}'
  `)[0];
  const safety = safetyRow ? safetyRow.values[0][0] : 0;
  if (stock <= safety) return 'crit';
  if (stock <= rop)    return 'warn';
  return 'norm';
}

/*
 * Дней до истощения запаса
 * Физика: остаток / средний дневной расход.
 * Показывает, через сколько дней сырьё закончится при текущем темпе
 */
export function daysUntilStockout(articleId) {
  const stock = getCurrentStock(articleId);
  const db = getDB();
  const row = db.exec(`
    SELECT avg_daily_consumption FROM items WHERE article_id = '${articleId}'
  `)[0];
  const avg = row.values[0][0];
  if (avg <= 0) return '∞';
  return Math.round(stock / avg);
}

/*
 * Получить рекомендации для закупщика
 * Физика: для каждой позиции ниже ROP рассчитываем объём заказа
 * с округлением до минимальной партии поставщика (договорное обязательство)
 */
export function getPurchaseRecommendations() {
  const db = getDB();
  const items = db.exec(`SELECT article_id, name, unit FROM items`)[0].values;
  const recommendations = [];

  items.forEach(([art, name, unit]) => {
    const status = getStatus(art);
    if (status === 'norm') return;

    const stock = getCurrentStock(art);
    const rop = calcROP(art);

    // Объём на 30 дней работы
    const row = db.exec(`SELECT avg_daily_consumption FROM items WHERE article_id='${art}'`)[0];
    const avgDaily = row.values[0][0];
    const need30 = avgDaily * 30;
    const deficit = need30 - stock;

    // Минимальная партия поставщика (договор)
    const supRow = db.exec(`
      SELECT s.min_batch_qty, s.lead_time_days, s.name
      FROM item_suppliers isp
      JOIN suppliers s ON s.supplier_id = isp.supplier_id
      WHERE isp.article_id = '${art}' AND isp.is_primary = 1
    `)[0];

    const minBatch = supRow ? supRow.values[0][0] : 1;
    const leadTime = supRow ? supRow.values[0][1] : 7;
    const supplierName = supRow ? supRow.values[0][2] : 'Не указан';

    // Округление вверх до минимальной партии
    const recommended = Math.ceil(deficit / minBatch) * minBatch;

    // Дедлайн заказа (сегодня + lead_time)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + leadTime);

    recommendations.push({
      articleId: art,
      name, unit, status, stock, rop,
      recommended: Math.max(recommended, minBatch),
      minBatch, supplierName, leadTime,
      deadline: deadline.toLocaleDateString('ru-RU'),
      daysLeft: daysUntilStockout(art)
    });
  });

  // Критичные сверху
  recommendations.sort((a, b) => a.status === 'crit' ? -1 : 1);
  return recommendations;
}

/*
 * Подсчёт позиций по статусам
 */
export function countByStatus() {
  const db = getDB();
  const items = db.exec(`SELECT article_id FROM items`)[0].values;
  const counts = { norm: 0, warn: 0, crit: 0, total: items.length };
  items.forEach(([art]) => { counts[getStatus(art)]++; });
  return counts;
}