import { getItems, getRecentMovements, getCurrentStock } from './data-layer.js';
import { calcROP, getStatus, daysUntilStockout, countByStatus } from './analytics.js';
import { initCharts } from './charts.js';

export function renderDashboard() {
    const counts = countByStatus();
    const recent = getRecentMovements(8);
    
    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi"><div class="kpi-label">Позиций в норме</div><div class="kpi-value" style="color:var(--norm);">${counts.norm}</div><div class="kpi-delta up">из ${counts.total} номенклатур</div></div>
        <div class="kpi warn"><div class="kpi-label">Требуют внимания</div><div class="kpi-value" style="color:var(--warn);">${counts.warn}</div><div class="kpi-delta">ниже точки заказа</div></div>
        <div class="kpi crit"><div class="kpi-label">Критический дефицит</div><div class="kpi-value" style="color:var(--crit);">${counts.crit}</div><div class="kpi-delta down">риск остановки производства</div></div>
        <div class="kpi"><div class="kpi-label">Движений за 7 дней</div><div class="kpi-value">${recent.length}</div><div class="kpi-delta">операций проведено</div></div>
    `;

    const items = getItems();
    const criticalItems = items
        .map(row => {
            const [art, name] = row;
            return { art, name, status: getStatus(art), stock: getCurrentStock(art), rop: calcROP(art) };
        })
        .filter(x => x.status !== 'norm')
        .sort((a, b) => a.status === 'crit' ? -1 : 1)
        .slice(0, 5);

    document.getElementById('criticalList').innerHTML = criticalItems.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--muted);">🟢 Все позиции в норме</div>'
        : criticalItems.map(x => `<div style="padding:12px;border-left:4px solid var(--${x.status});background:var(--panel-2);margin-bottom:8px;border-radius:4px;"><div style="font-weight:600;font-size:13px;">${x.name}</div><div style="font-size:12px;color:var(--muted);margin-top:4px;">Остаток: <b>${x.stock}</b> · ROP: ${x.rop} · Дней до истощения: <b>${daysUntilStockout(x.art)}</b></div></div>`).join('');

    document.getElementById('recentMovements').innerHTML = recent.map(row => {
        const [mvId, art, date, delta, type, comment, itemName] = row;
        const typeLabel = {receipt:'📥 Приход', consumption:'⚙️ Расход', sale:'🚚 Продажа', adjustment:'🔧 Корректировка'}[type];
        const color = delta > 0 ? 'var(--norm)' : 'var(--crit)';
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:13px;"><div><div>${typeLabel} · <b>${itemName}</b></div><div style="font-size:11px;color:var(--muted);">${date}</div></div><div style="font-weight:600;color:${color};">${delta > 0 ? '+' : ''}${delta}</div></div>`;
    }).join('');
}

let chartsVisible = false;
let chartsInitialized = false;

export function toggleCharts() {
    chartsVisible = !chartsVisible;
    const container = document.getElementById('chartsContainer');
    const btn = document.getElementById('btnToggleCharts');
    if (!container || !btn) return;
    
    if (chartsVisible) {
        container.style.display = 'block';
        btn.textContent = '📊 Скрыть графики';
        if (!chartsInitialized) {
            renderDashboardCharts();
            chartsInitialized = true;
        }
    } else {
        container.style.display = 'none';
        btn.textContent = '📊 Показать графики';
    }
}

function renderDashboardCharts() {
    const items = getItems();
    const consumptionLabels = Array.from({length: 30}, (_, i) => `День ${i + 1}`);
    const consumptionValues = Array.from({length: 30}, () => Math.floor(Math.random() * 50) + 10);
    
    const movements = getRecentMovements(100);
    const movementTypes = { receipt: 0, consumption: 0, sale: 0 };
    movements.forEach(m => { if (movementTypes[m[4]] !== undefined) movementTypes[m[4]]++; });

    const stockByCategory = {};
    items.forEach(row => {
        const [art, name, cat] = row;
        if (!stockByCategory[cat]) stockByCategory[cat] = 0;
        stockByCategory[cat] += getCurrentStock(art);
    });

    initCharts(
        { labels: consumptionLabels, values: consumptionValues },
        { labels: ['Приход', 'Расход', 'Продажа'], values: [movementTypes.receipt, movementTypes.consumption, movementTypes.sale] },
        { labels: ['Сырьё', 'Расходники', 'Готовая продукция'], values: [stockByCategory.raw_material || 0, stockByCategory.consumable || 0, stockByCategory.finished_good || 0] }
    );
}

export function renderStock() {
    const catFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const items = getItems();
    const categoryLabel = {raw_material:'Сырьё', consumable:'Расходники', finished_good:'ГП'};
    const filtered = items
        .map(row => {
            const [art, name, cat, unit, avg, safetyDays] = row;
            return { art, name, cat, unit, avg, stock: getCurrentStock(art), rop: calcROP(art), status: getStatus(art), days: daysUntilStockout(art) };
        })
        .filter(x => {
            if (catFilter !== 'all' && x.cat !== catFilter) return false;
            if (statusFilter !== 'all' && x.status !== statusFilter) return false;
            return true;
        });

    document.getElementById('stockTable').innerHTML = filtered.map(x => `<tr><td><code style="background:#f1f5f9;padding:2px 6px;border-radius:3px;font-size:12px;">${x.art}</code></td><td><b>${x.name}</b></td><td>${categoryLabel[x.cat]}</td><td class="text-right"><b>${x.stock}</b> ${x.unit}</td><td class="text-right">${x.rop}</td><td class="text-right">${x.avg}</td><td><span class="status ${x.status}"><span class="status-dot"></span>${x.status === 'norm' ? 'Норма' : x.status === 'warn' ? 'Внимание' : 'Критично'}</span></td><td class="text-right" style="font-weight:600;color:${x.days < 7 ? 'var(--crit)' : x.days < 14 ? 'var(--warn)' : 'var(--text)'};">${x.days}</td></tr>`).join('');
}

export function renderMovements() {
    const items = getItems();
    document.getElementById('mvItem').innerHTML = items.map(row => {
        const [art, name] = row;
        return `<option value="${art}">${name} (${art})</option>`;
    }).join('');

    const movements = getRecentMovements(30);
    const typeLabel = {receipt:'📥 Приход', consumption:'⚙️ Расход', sale:'🚚 Продажа', adjustment:'🔧 Корректировка'};
    document.getElementById('movementsTable').innerHTML = movements.map(row => {
        const [mvId, art, date, delta, type, comment, itemName] = row;
        return `<tr><td>${date}</td><td>${typeLabel[type] || type}</td><td><b>${itemName}</b></td><td class="text-right" style="font-weight:600;color:${delta > 0 ? 'var(--norm)' : 'var(--crit)'};">${delta > 0 ? '+' : ''}${delta}</td><td class="text-muted">${comment || ''}</td></tr>`;
    }).join('');
}

export function renderSQLResult(result) {
    if (!result.success) {
        document.getElementById('sqlResult').innerHTML = `<div style="padding:14px;background:#fee2e2;color:#991b1b;border-radius:6px;font-family:monospace;font-size:12px;">❌ ${result.error}</div>`;
        document.getElementById('sqlResultInfo').textContent = '✗ Ошибка';
        return;
    }
    if (!result.data) {
        document.getElementById('sqlResult').innerHTML = '<div style="padding:20px;color:var(--muted);text-align:center;">Запрос выполнен. Нет данных для отображения.</div>';
        document.getElementById('sqlResultInfo').textContent = `✓ Выполнено за ${result.time} мс`;
        return;
    }
    const { columns, values } = result.data;
    let html = '<table><thead><tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
    values.forEach(row => {
        html += '<tr>' + row.map(v => `<td>${v === null ? '<i class="text-muted">NULL</i>' : v}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('sqlResult').innerHTML = html;
    document.getElementById('sqlResultInfo').textContent = `✓ ${values.length} строк за ${result.time} мс`;
}

export function renderAll() {
    renderDashboard();
    renderStock();
    renderMovements();
}