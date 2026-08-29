/* ============================================================
   МОДУЛЬ: app.js
   ОТВЕТСТВЕННОСТЬ: Точка входа приложения — инициализация БД,
   связывание модулей, запуск первого рендера, автоалерты
   ФИЗИКА ПРОЦЕССА: модуль координирует запуск всех подсистем
   в правильном порядке: сначала БД → потом UI → потом рендер
   → потом сканирование склада на критический дефицит через
   те же функции, что использует дашборд (единый источник истины)
   ============================================================ */

import { initDatabase, countRows } from './db.js';
import { renderAll } from './render.js';
import { bindEventListeners, exposeGlobals, switchTab } from './ui.js';
import { getPurchaseRecommendations, countByStatus } from './analytics.js';

/* ============================================================
   СКАНИРОВАНИЕ КРИТИЧЕСКИХ ПОЗИЦИЙ И ОТПРАВКА АЛЕРТА
   ФИЗИКА: используем те же функции, что и дашборд (getPurchaseRecommendations),
   чтобы цифры в алерте совпадали с цифрами в интерфейсе.
   Шлём только статус 'crit' — риск остановки конвейера.
   Сетевой сбой шлюза НЕ роняет приложение (оборачиваем в try-catch).
   ============================================================ */
async function checkCriticalAndAlert() {
  try {
    // Считаем позиции по статусам (та же функция, что и для KPI-карточек)
    const counts = countByStatus();

    if (counts.crit === 0) {
      console.log(`✅ Критического дефицита нет. Предупреждений: ${counts.warn}.`);
      return;
    }

    // Получаем рекомендации для закупщика (уже отсортированы: критичные сверху)
    const recommendations = getPurchaseRecommendations();
    const critical = recommendations.filter(r => r.status === 'crit');

    if (critical.length === 0) {
      console.log('⚠️ Есть предупреждения, но критических дефицитов нет.');
      return;
    }

    // Формируем читаемый текст алерта с физической информацией:
    // остаток, единицы измерения, дней до истощения, точка заказа, объём закупки
    const lines = critical.map(r =>
      `• ${r.name}\n  Остаток: ${r.stock} ${r.unit} (хватит на ${r.daysLeft} дн.)\n  ROP: ${r.rop}, Заказать: ${r.recommended} ${r.unit}`
    );
    const text = `🚨 КРИТИЧЕСКИЙ ДЕФИЦИТ (${critical.length} поз.)\n\n${lines.join('\n\n')}`;

    // Асинхронный выстрел в serverless-шлюз, не блокируем работу UI
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (response.ok) {
      console.log(`📲 Алерт ушёл в Telegram: ${critical.length} критических позиций.`);
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