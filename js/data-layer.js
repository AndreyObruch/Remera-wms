/* ============================================================
   МОДУЛЬ: data-layer.js
   ОТВЕТСТВЕННОСТЬ: Абстракция доступа к данным (SQL-запросы),
   изоляция UI от прямой работы с БД
   ФИЗИКА ПРОЦЕССА: все запросы к БД проходят через этот слой,
   что позволяет завтра заменить SQLite на REST API без изменения UI
   ============================================================ */

import { getDB } from './db.js';

/* ============================================================
   ЗАПРОСЫ К СПРАВОЧНИКАМ
   ============================================================ */

/*
 * Получить все позиции номенклатуры
 */
export function getItems() {
  const db = getDB();
  const result = db.exec(`SELECT * FROM items ORDER BY category, name`);
  return result.length > 0 ? result[0].values : [];
}

/*
 * Получить позицию по артикулу
 */
export function getItemByArticle(articleId) {
  const db = getDB();
  const result = db.exec(`SELECT * FROM items WHERE article_id = '${articleId}'`);
  return result.length > 0 ? result[0].values[0] : null;
}

/*
 * Получить всех поставщиков
 */
export function getSuppliers() {
  const db = getDB();
  const result = db.exec(`SELECT * FROM suppliers ORDER BY name`);
  return result.length > 0 ? result[0].values : [];
}

/*
 * Получить связи ТМЦ-поставщик
 */
export function getItemSuppliers() {
  const db = getDB();
  const result = db.exec(`
    SELECT isp.*, i.name as item_name, s.name as supplier_name
    FROM item_suppliers isp
    JOIN items i ON isp.article_id = i.article_id
    JOIN suppliers s ON isp.supplier_id = s.supplier_id
    ORDER BY i.name
  `);
  return result.length > 0 ? result[0].values : [];
}

/* ============================================================
   ЗАПРОСЫ К ДВИЖЕНИЯМ ТМЦ
   ============================================================ */

/*
 * Получить движения с фильтрами
 */
export function getMovements(filters = {}) {
  const db = getDB();
  let query = `
    SELECT m.*, i.name as item_name
    FROM inventory_movements m
    JOIN items i ON m.article_id = i.article_id
    WHERE 1=1
  `;
  
  if (filters.articleId) {
    query += ` AND m.article_id = '${filters.articleId}'`;
  }
  if (filters.type) {
    query += ` AND m.movement_type = '${filters.type}'`;
  }
  if (filters.days) {
    query += ` AND m.movement_date >= date('now', '-${filters.days} days')`;
  }
  
  query += ` ORDER BY m.movement_id DESC`;
  
  if (filters.limit) {
    query += ` LIMIT ${filters.limit}`;
  }
  
  const result = db.exec(query);
  return result.length > 0 ? result[0].values : [];
}

/*
 * Получить последние N движений
 */
export function getRecentMovements(limit = 30) {
  return getMovements({ limit });
}

/* ============================================================
   РАСЧЁТЫ ОСТАТКОВ
   ============================================================ */

/*
 * Текущий остаток по артикулу
 * Физика: сумма всех движений (приход − расход)
 */
export function getCurrentStock(articleId) {
  const db = getDB();
  const result = db.exec(`
    SELECT COALESCE(SUM(delta_qty), 0)
    FROM inventory_movements
    WHERE article_id = '${articleId}'
  `);
  return result.length > 0 ? Math.round(result[0].values[0][0]) : 0;
}

/*
 * Остатки по всем позициям
 */
export function getAllStocks() {
  const db = getDB();
  const result = db.exec(`
    SELECT i.article_id, i.name, i.unit,
           COALESCE(SUM(m.delta_qty), 0) as stock
    FROM items i
    LEFT JOIN inventory_movements m ON m.article_id = i.article_id
    GROUP BY i.article_id
    ORDER BY i.category, i.name
  `);
  return result.length > 0 ? result[0].values : [];
}

/* ============================================================
   ПРОВОДКА ДВИЖЕНИЙ
   ============================================================ */

/*
 * Провести новое движение
 * Физика: валидация + вставка в БД
 */
export function postMovement(articleId, deltaQty, movementType, comment = '') {
  const db = getDB();
  
  try {
    db.run(`
      INSERT INTO inventory_movements
        (article_id, movement_date, delta_qty, movement_type, comment)
      VALUES (?, date('now'), ?, ?, ?)
    `, [articleId, deltaQty, movementType, comment]);
    
    return { success: true, message: 'Движение проведено' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ============================================================
   SQL-КОНСОЛЬ
   ============================================================ */

/*
 * Выполнить произвольный SQL-запрос
 */
export function executeSQL(sql) {
  const db = getDB();
  const t0 = performance.now();
  
  try {
    const result = db.exec(sql);
    const t1 = performance.now();
    
    return {
      success: true,
      data: result.length > 0 ? result[0] : null,
      time: (t1 - t0).toFixed(1),
      rows: result.length > 0 ? result[0].values.length : 0
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      time: (performance.now() - t0).toFixed(1)
    };
  }
}

/* ============================================================
   УТИЛИТЫ
   ============================================================ */

/*
 * Подсчёт строк в таблице движений
 */
export function countMovements() {
  const db = getDB();
  const result = db.exec(`SELECT COUNT(*) FROM inventory_movements`);
  return result.length > 0 ? result[0].values[0][0] : 0;
}