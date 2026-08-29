/* ============================================================
   МОДУЛЬ: app.js
   ОТВЕТСТВЕННОСТЬ: Точка входа приложения — инициализация БД,
   связывание модулей, запуск первого рендера, автоалерты
   ФИЗИКА ПРОЦЕССА: модуль координирует запуск всех подсистем
   в правильном порядке: сначала БД → потом UI → потом рендер
   → потом сканирование склада на критический дефицит
   ============================================================ */

import { initDatabase, countRows } from './db.js';
import { renderAll } from './render.js';
import { bindEventListeners, exposeGlobals, switchTab } from './ui.js';

/* ============================================================
   СКАНИРОВАНИЕ КРИТИЧЕСКИХ ПОЗИЦИЙ И ОТПРАВКА АЛЕРТА
   ФИЗИКА: после загрузки склада проверяем, есть ли позиции,
   остаток которых ниже точки заказа (ROP) с запасом менее 2 дней.
   Если есть — стреляем в Telegram через serverless-шлюз.
   Сетевой сбой шлюза НЕ роняет приложение (оборачиваем в try-catch).
   ============================================================ */
async function checkCriticalAndAlert() {
  try {
    if (!window.db) return;
    
    // SQL: ищем все позиции, где осталось меньше ROP (критический дефицит)
    const result = window.db.exec(`
      SELECT name, quantity, unit, rop 
      FROM stock 
      WHERE quantity < rop AND rop > 0
      ORDER BY (quantity * 1.0 / rop) ASC
      LIMIT 10
    `);
    
    if (!result || result.length === 0) {
      console.log('✅ Критического дефицита нет, алерт не нужен.');
      return;
    }
    
    const rows = result[0].values;
    
    // Собираем текст алерта в читаемом для директора виде
    const lines = rows.map(r => `• ${r[0]}: ${r[1]} ${r[2]} из ${r[3]}`);
    const text = `Найдено ${rows.length} позиций ниже точки заказа:\n\n${lines.join('\n')}`;
    
    // Асинхронный выстрел в шлюз, не блокируем работу UI
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    
    if (response.ok) {
      console.log('📲 Алерт ушёл в Telegram.');
    } else {
      console.warn('⚠️ Шлюз Telegram недоступен, алерт не ушёл (работа WMS не нарушена).');
    }
  } catch (e) {
    // Защита конвейера: любая ошибка алерта не должна ломать интерфейс
    console.warn('⚠️ Сбой автоалерта (не критично):', e.message);
  }
}

/* ============================================================
   ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА
   ============================================================ */

async function bootstrap() {
  try {
    // 1. Инициализация SQLite (загрузка WASM, создание схемы, генерация данных)
    await initDatabase();

    // 2. Регистрация глобальных функций для inline-обработчиков в HTML
    exposeGlobals();

    // 3. Привязка обработчиков событий (SQL-пресеты, дата, статус БД)
    bindEventListeners();

    // 4. Первый рендер всех вкладок
    renderAll();

    // 5. Активация вкладки "Дашборд" по умолчанию
    const dashboardNav = document.querySelector('.nav-item');
    if (dashboardNav) switchTab('dashboard', dashboardNav);

    // 6. Сканирование склада и автоалерт в Telegram
    await checkCriticalAndAlert();

    console.log('✅ Ремера WMS запущена. Записей в БД:', countRows());

  } catch (e) {
    console.error('❌ Критическая ошибка запуска:', e);
    document.getElementById('dbStatus').innerHTML = '● Ошибка: ' + e.message;
  }
}

/* ============================================================
   ТОЧКА ВХОДА DOM
   ============================================================ */

document.addEventListener('DOMContentLoaded', bootstrap);