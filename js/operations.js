/* ============================================================
   МОДУЛЬ: operations.js
   ОТВЕТСТВЕННОСТЬ: Бизнес-операции — проводка движений ТМЦ,
   валидация, защита производственного конвейера
   ФИЗИКА ПРОЦЕССА: любая операция должна пройти валидацию
   перед записью в БД. Расход не может увести остаток в минус —
   это защита от остановки реального производства.
   ============================================================ */

import { getCurrentStock, postMovement as dbPostMovement, getItemByArticle } from './data-layer.js';
import { getStatus, calcROP } from './analytics.js';

/* ============================================================
   ПРОВОДКА ДВИЖЕНИЯ С ВАЛИДАЦИЕЙ
   ============================================================ */

/*
 * Провести новое движение с полной проверкой
 * Физика: перед записью проверяем, что:
 *   1) номенклатура существует
 *   2) количество > 0
 *   3) расход не уводит остаток в отрицательную зону
 * Возвращаем объект { success, message, data } для UI
 */
export function postMovement(type, articleId, qty, comment = '') {
  // Валидация входных данных
  const validation = validateMovement({ type, articleId, qty });
  if (!validation.valid) {
    return { success: false, message: validation.error };
  }

  // Расчёт дельты: приход — положительный, расход/продажа — отрицательный
  const delta = (type === 'receipt') ? qty : -qty;

  // Защита конвейера: расход не должен увести остаток в минус
  if (delta < 0) {
    const stock = getCurrentStock(articleId);
    if (stock + delta < 0) {
      return {
        success: false,
        message: `Недостаточно остатка. На складе: ${stock}, списывается: ${-delta}`
      };
    }
  }

  // Проводка в БД через data-layer
  const result = dbPostMovement(articleId, delta, type, comment || 'Операция пользователя');

  if (result.success) {
    // После проводки проверяем, не перешла ли позиция в критический статус
    const newStatus = getStatus(articleId);
    const item = getItemByArticle(articleId);
    const itemName = item ? item[1] : articleId;

    return {
      success: true,
      message: 'Движение проведено',
      alert: newStatus === 'crit'
        ? { level: 'crit', text: `🔴 ${itemName} в критическом дефиците!` }
        : newStatus === 'warn'
          ? { level: 'warn', text: `🟡 ${itemName} ниже точки заказа` }
          : null
    };
  }

  return { success: false, message: result.message };
}

/* ============================================================
   ВАЛИДАЦИЯ ДВИЖЕНИЯ
   ============================================================ */

/*
 * Проверка корректности данных перед проводкой
 * Физика: отлавливаем ошибки на входе, чтобы не ломать БД
 */
export function validateMovement(data) {
  if (!data.type || !['receipt', 'consumption', 'sale'].includes(data.type)) {
    return { valid: false, error: 'Не указан тип операции' };
  }
  if (!data.articleId) {
    return { valid: false, error: 'Не выбрана номенклатура' };
  }
  if (!data.qty || data.qty <= 0 || isNaN(data.qty)) {
    return { valid: false, error: 'Количество должно быть положительным числом' };
  }

  const item = getItemByArticle(data.articleId);
  if (!item) {
    return { valid: false, error: 'Номенклатура не найдена в базе' };
  }

  return { valid: true };
}

/* ============================================================
   БЫСТРЫЕ ОПЕРАЦИИ (для демо-режима)
   ============================================================ */

/*
 * Произвести партию ГП (расход сырья → +ГП)
 * Физика: имитация производственного цикла — списываем сырьё
 * по рецептуре, приходуюем готовую продукцию
 */
export function produceBatch(fgArticleId, recipe) {
  // recipe: { rawArticleId: qty, ... }
  for (const rawId in recipe) {
    const need = recipe[rawId];
    const stock = getCurrentStock(rawId);
    if (stock < need) {
      const item = getItemByArticle(rawId);
      return {
        success: false,
        message: `Недостаточно ${item ? item[1] : rawId}. Остаток: ${stock}, нужно: ${need}`
      };
    }
  }

  // Списываем сырьё
  for (const rawId in recipe) {
    dbPostMovement(rawId, -recipe[rawId], 'consumption', 'Производство партии ГП');
  }

  // Приходуем ГП (500 единиц за раз)
  dbPostMovement(fgArticleId, 500, 'receipt', 'Выпуск из производства');

  return { success: true, message: 'Партия произведена' };
}

/*
 * Получить рекомендации по закупкам
 * Физика: агрегируем данные из analytics.js в формат для UI
 */
export function getReorderRecommendations() {
  const { getPurchaseRecommendations } = require('./analytics.js');
  return getPurchaseRecommendations();
}