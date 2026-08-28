/* ============================================================
   МОДУЛЬ: app.js
   ОТВЕТСТВЕННОСТЬ: Точка входа приложения — инициализация БД,
   связывание модулей, запуск первого рендера
   ФИЗИКА ПРОЦЕССА: модуль координирует запуск всех подсистем
   в правильном порядке: сначала БД → потом UI → потом рендер
   ============================================================ */

import { initDatabase, countRows } from './db.js';
import { renderAll } from './render.js';
import { bindEventListeners, exposeGlobals, switchTab } from './ui.js';

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