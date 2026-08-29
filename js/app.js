/* ============================================================
   МОДУЛЬ: app.js
   ОТВЕТСТВЕННОСТЬ: Точка входа приложения — инициализация БД,
   связывание модулей, запуск первого рендера, автоалерты с дросселем
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
   ДРОССЕЛЬ АЛЕРТОВ (24 ЧАСА)
   ФИЗИКА: директору важно знать о факте дефицита, а не получать
   10 одинаковых сообщений в день. Повторный алерт с тем же списком
   позиций шлём не чаще раза в сутки. Если список дефицита изменился
   (появилась новая позиция) — шлём немедленно, это новый риск.
   ============================================================ */
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function shouldSendAlert(criticalIds) {
  try {
    const now = Date.now();
    const lastTime = parseInt(localStorage.getItem('remeraLastAlertTime') || '0', 10);
    const lastIds = localStorage.getItem('remeraLastAlertIds') || '';
    const currentIds = criticalIds.join(',');

    // Список дефицита изменился — новый риск, шлём немедленно
    if (currentIds !== lastIds) return true;
    // Тот же список, но прошли сутки — напоминаем раз в день
    if (now - lastTime > ALERT_COOLDOWN_MS) return true;
    return false;
  } catch (e) {
    // localStorage недоступен (приватный режим) — не блокируем алерт
    return true;
  }
}

function markAlertSent(criticalIds) {
  try {
    localStorage.setItem('remeraLastAlertTime', String(Date.now()));
    localStorage.setItem('remeraLastAlertIds', criticalIds.join(','));
  } catch (e) {
    // Не критично: без метки дроссель просто не сработает
  }
}

/* ============================================================
   СКАНИРОВАНИЕ КРИТИЧЕСКИХ ПОЗИЦИЙ И ОТПРАВКА АЛЕРТА
   ФИЗИКА: используем те же функции, что и дашборд, чтобы цифры
   в алерте совпадали с интерфейсом. Шлём только статус 'crit'.
   Сетевой сбой шлюза НЕ роняет приложение (try-catch).
   ============================================================ */
async function checkCriticalAndAlert() {
  try {
    const counts = countByStatus();

    if (counts.crit === 0) {
      console.log(`✅ Критического дефицита нет. Предупреждений: ${counts.warn}.`);
      return;
    }

    const recommendations = getPurchaseRecommendations();
    const critical = recommendations.filter(r => r.status === 'crit');

    if (critical.length === 0) return;

    const criticalIds = critical.map(r => r.articleId);

    // Дроссель: не спамят директора одним и тем же списком
    if (!shouldSendAlert(criticalIds)) {
      console.log('⏸ Алерт подавлен дросселем 24ч (список не изменился).');
      return;
    }

    const lines = critical.map(r =>
      `• ${r.name}\n  Остаток: ${r.stock} ${r.unit} (хватит на ${r.daysLeft} дн.)\n  ROP: ${r.rop}, Заказать: ${r.recommended} ${r.unit}`
    );
    const text = `🚨 КРИТИЧЕСКИЙ ДЕФИЦИТ (${critical.length} поз.)\n\n${lines.join('\n\n')}`;

    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (response.ok) {
      // Метку ставим ТОЛЬКО после успешной отправки — иначе алерт потеряется
      markAlertSent(criticalIds);
      console.log(`📲 Алерт ушёл в Telegram: ${critical.length} критических позиций.`);
    } else {
      console.warn('⚠️ Шлюз Telegram недоступен, алерт не ушёл (работа WMS не нарушена).');
    }
  } catch (e) {
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