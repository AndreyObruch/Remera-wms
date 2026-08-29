/* ============================================================
   МОДУЛЬ: one-c.js
   ОТВЕТСТВЕННОСТЬ: Интеграция с 1С — импорт снапшота остатков
   через CSV, генерация шаблона для бухгалтера
   ФИЗИКА ПРОЦЕССА:
   - 1С выгружает CSV с текущими остатками по нашему контракту колонок
   - WMS сверяет с локальным балансом и проводит adjustment-доводку
   - Если появились новые критические позиции — сбрасываем дроссель
     алертов, чтобы Telegram немедленно уведомил о новом риске
   - История движений хранит след: «Синхронизация с 1С»
   ============================================================ */

import { getDB } from './db.js';
import { getCurrentStock } from './data-layer.js';
import { renderAll } from './render.js';
import { getPurchaseRecommendations } from './analytics.js';

/* Контракт колонок: 1С обязан выгружать ровно эти 5 полей */
const EXPECTED_HEADERS = ['article_id', 'name', 'category', 'unit', 'quantity'];
const ALLOWED_CATEGORIES = ['raw_material', 'consumable', 'finished_good'];

/* ============================================================
   TOAST-УВЕДОМЛЕНИЯ
   ФИЗИКА: неблокирующее всплывающее окно в правом нижнем углу.
   Исчезает через 5 секунд или по клику.
   ============================================================ */
function showToast(title, body, type = 'info') {
  const existing = document.querySelectorAll('.toast');
  existing.forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-body">${body}</div>
  `;
  toast.onclick = () => toast.remove();
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

/* ============================================================
   ШАБЛОН CSV ДЛЯ БУХГАЛТЕРА 1С
   ФИЗИКА: скачиваем файл-образец с BOM (чтобы Excel корректно
   открывал UTF-8) и разделителем ; (стандарт Excel для RU)
   ============================================================ */
export function download1CTemplate() {
  const bom = '\uFEFF';
  const rows = [
    EXPECTED_HEADERS.join(';'),
    'PA-935;Нить полиамидная 935 текс;raw_material;кг;1250',
    'PP-1100;Нить полипропиленовая 1100 текс;raw_material;кг;980',
    'PAT-10;Канат полиамидный ПАТ-10 (d=10мм);finished_good;м;2800',
    'BOB-K;Бобины картонные;consumable;шт;320'
  ];
  const csv = bom + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'remere-1c-template.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📋 Шаблон 1С скачан', 'Передайте файл бухгалтеру для настройки отчёта выгрузки', 'success');
}

/* ============================================================
   ИМПОРТ CSV ИЗ 1С
   ФИЗИКА: парсим файл, для каждой строки сверяем артикул с БД.
   Проводим adjustment-доводку баланса до цифры из 1С.
   ============================================================ */
export function import1C(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      process1CFile(e.target.result);
    } catch (err) {
      console.error('Ошибка импорта 1С:', err);
      showToast('❌ Ошибка импорта 1С', err.message, 'error');
    }
    // Сбрасываем input, чтобы тот же файл можно было импортировать повторно
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function process1CFile(rawText) {
  // Снимаем BOM, если есть
  const text = rawText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Файл пустой или содержит только заголовок');
  }

  // Автоопределение разделителя: ; или ,
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // Валидация контракта колонок
  const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`Отсутствуют колонки: ${missing.join(', ')}. Ожидалось: ${EXPECTED_HEADERS.join(', ')}`);
  }

  // Индексы колонок
  const idx = Object.fromEntries(EXPECTED_HEADERS.map(h => [h, headers.indexOf(h)]));

  const db = getDB();
  const stats = { updated: 0, skipped: 0, total: 0, details: [] };
  const today = new Date().toISOString().slice(0, 10);

  // Проходим по строкам данных
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < EXPECTED_HEADERS.length) {
      stats.skipped++;
      continue;
    }

    const art = parts[idx.article_id].trim();
    const qtyStr = parts[idx.quantity].trim().replace(',', '.');
    const qty1C = parseFloat(qtyStr);

    stats.total++;

    if (!art || isNaN(qty1C)) {
      stats.skipped++;
      continue;
    }

    // Проверка: артикул должен существовать в справочнике items
    const itemExists = db.exec(`SELECT article_id FROM items WHERE article_id='${art}'`)[0];
    if (!itemExists) {
      stats.skipped++;
      stats.details.push(`Пропущен: ${art} (нет в справочнике)`);
      continue;
    }

    // Считаем текущий баланс и delta для доводки
    const currentStock = getCurrentStock(art);
    const delta = qty1C - currentStock;

    if (Math.abs(delta) < 0.01) {
      // Остаток уже совпадает — ничего не делаем
      continue;
    }

    // Защита: не допускаем отрицательного баланса после adjustment
    if (qty1C < 0) {
      stats.skipped++;
      stats.details.push(`Пропущен: ${art} (отрицательное количество в 1С)`);
      continue;
    }

    db.run(`
      INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment)
      VALUES ('${art}', '${today}', ${delta}, 'adjustment', 'Синхронизация с 1С (${qty1C} vs ${currentStock})')
    `);
    stats.updated++;
  }

  // Перерисовываем интерфейс — дашборд, склад, движения
  renderAll();

  // Если появились новые критические позиции — сбрасываем дроссель,
  // чтобы Telegram-алерт сработал немедленно (новый риск)
  const criticalNow = getPurchaseRecommendations().filter(r => r.status === 'crit');
  if (criticalNow.length > 0) {
    try {
      localStorage.removeItem('remeraLastAlertIds');
    } catch (e) { /* не критично */ }
  }

  const msg = `Синхронизация с 1С завершена.<br>
    Обновлено: <b>${stats.updated}</b> позиций<br>
    Пропущено: <b>${stats.skipped}</b> из ${stats.total}`;

  if (stats.updated > 0) {
    showToast('📥 1С: Остатки синхронизированы', msg, 'success');
    console.log('✅ 1С импорт:', stats);
  } else {
    showToast('⚠️ 1С: Изменений нет', msg, 'warn');
    console.warn('⚠️ 1С импорт без изменений:', stats);
  }
}