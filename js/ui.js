import { renderAll, renderStock, renderSQLResult, toggleCharts } from './render.js';
import { postMovement } from './operations.js';
import { executeSQL } from './data-layer.js';
import { countRows } from './db.js';
import { downloadSQLite, downloadStockCSV, downloadMovementsCSV, importSQLite } from './export.js';

const SQL_PRESETS = [
  `-- Текущие остатки по всем позициям\nSELECT i.article_id, i.name, i.unit,\n       SUM(m.delta_qty) AS stock\nFROM items i\nLEFT JOIN inventory_movements m ON m.article_id = i.article_id\nGROUP BY i.article_id\nORDER BY stock DESC;`,
  `-- Критичные позиции (остаток ниже ROP)\nSELECT i.name, SUM(m.delta_qty) AS stock,\n       i.avg_daily_consumption * (COALESCE(s.lead_time_days,0) + i.safety_stock_days) AS rop\nFROM items i\nLEFT JOIN item_suppliers isp ON isp.article_id=i.article_id AND isp.is_primary=1\nLEFT JOIN suppliers s ON s.supplier_id=isp.supplier_id\nLEFT JOIN inventory_movements m ON m.article_id=i.article_id\nGROUP BY i.article_id\nHAVING stock <= rop\nORDER BY stock ASC;`,
  `-- Движения за последние 7 дней\nSELECT m.movement_date, i.name, m.delta_qty, m.movement_type\nFROM inventory_movements m\nJOIN items i ON m.article_id=i.article_id\nWHERE m.movement_date >= date('now','-7 days')\nORDER BY m.movement_id DESC LIMIT 50;`,
  `-- Топ-5 позиций по расходу за 30 дней\nSELECT i.name, SUM(ABS(m.delta_qty)) AS total_consumed\nFROM inventory_movements m\nJOIN items i ON m.article_id=i.article_id\nWHERE m.delta_qty < 0 AND m.movement_date >= date('now','-30 days')\nGROUP BY i.article_id\nORDER BY total_consumed DESC LIMIT 5;`,
  `-- Поставщики и их условия\nSELECT s.name, s.lead_time_days, s.min_batch_qty, s.contract_type,\n       COUNT(isp.article_id) AS sku_count\nFROM suppliers s\nLEFT JOIN item_suppliers isp ON isp.supplier_id=s.supplier_id\nGROUP BY s.supplier_id;`,
  `-- ABC-анализ: топ-20% позиций дают 80% расхода\nSELECT i.name, SUM(ABS(m.delta_qty)) AS total\nFROM inventory_movements m\nJOIN items i ON m.article_id=i.article_id\nWHERE m.delta_qty < 0\nGROUP BY i.article_id\nORDER BY total DESC;`
];

export function switchTab(tabId, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  if (el) el.classList.add('active');
}

export function showToast(message, type = 'ok') {
  const toast = document.createElement('div');
  const colors = {
    ok:   { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
    warn: { bg: '#fef3c7', border: '#eab308', text: '#854d0e' },
    crit: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' }
  };
  const c = colors[type] || colors.ok;

  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    padding: 12px 18px; border-radius: 8px; font-size: 13px;
    background: ${c.bg}; border-left: 4px solid ${c.border};
    color: ${c.text}; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease; max-width: 360px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function handlePostMovement() {
  const type = document.getElementById('mvType').value;
  const art  = document.getElementById('mvItem').value;
  const qty  = parseFloat(document.getElementById('mvQty').value);

  const result = postMovement(type, art, qty);

  if (result.success) {
    showToast('✅ ' + result.message, 'ok');
    if (result.alert) {
      setTimeout(() => showToast(result.alert.text, result.alert.level), 500);
    }
    renderAll();
  } else {
    showToast('❌ ' + result.message, 'crit');
  }
}

function handleRunSQL() {
  const sql = document.getElementById('sqlEditor').value.trim();
  if (!sql) {
    showToast('Введите SQL-запрос', 'warn');
    return;
  }
  const result = executeSQL(sql);
  renderSQLResult(result);
}

export function setPreset(i) {
  document.getElementById('sqlEditor').value = SQL_PRESETS[i];
}

function initSQLPresets() {
  const container = document.getElementById('sqlPresets');
  const labels = ['Текущие остатки', 'Критичные позиции', 'Движения за 7 дней', 'Топ-5 по расходу', 'Поставщики', 'ABC-анализ'];
  container.innerHTML = labels.map((label, i) =>
    `<div class="preset-btn" onclick="window.__setPreset(${i})">${label}</div>`
  ).join('');
  setPreset(0);
}

export function bindEventListeners() {
  initSQLPresets();

  document.getElementById('sqlPresets').addEventListener('click', (e) => {
    if (e.target.classList.contains('preset-btn')) {
      const idx = Array.from(e.target.parentNode.children).indexOf(e.target);
      setPreset(idx);
    }
  });

  try {
    const rows = countRows();
    document.getElementById('dbStatus').innerHTML = `● SQLite: OK · ${rows} записей`;
  } catch (e) {
    document.getElementById('dbStatus').innerHTML = '● Ошибка БД';
  }

  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

window.switchTab = switchTab;
window.renderStock = renderStock;
window.postMovement = handlePostMovement;
window.runSQL = handleRunSQL;
window.__setPreset = setPreset;
window.toggleCharts = toggleCharts;
window.downloadSQLite = downloadSQLite;
window.downloadStockCSV = downloadStockCSV;
window.downloadMovementsCSV = downloadMovementsCSV;
window.importSQLite = importSQLite;

export function exposeGlobals() {
  window.switchTab = switchTab;
  window.renderStock = renderStock;
  window.postMovement = handlePostMovement;
  window.runSQL = handleRunSQL;
  window.__setPreset = setPreset;
  window.toggleCharts = toggleCharts;
  window.downloadSQLite = downloadSQLite;
  window.downloadStockCSV = downloadStockCSV;
  window.downloadMovementsCSV = downloadMovementsCSV;
  window.importSQLite = importSQLite;
}