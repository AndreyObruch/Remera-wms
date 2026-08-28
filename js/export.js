// Модуль экспорта/импорта. Динамические импорты вместо статических,
// чтобы сбой одного модуля не ронял всё приложение при загрузке.

function stamp() {
    return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Дамп живой БД в бинарный файл SQLite — снимок состояния склада на момент клика
export async function downloadSQLite() {
    const { getDB } = await import('./db.js');
    const db = getDB();
    if (!db) {
        alert('❌ База данных не инициализирована');
        return;
    }
    const data = db.export();
    triggerDownload(new Blob([data], { type: 'application/octet-stream' }), `remera_wms_${stamp()}.sqlite`);
}

// Выгрузка склада в CSV с разделителем ; и BOM — чтобы Excel открыл кириллицу без кракозябр
export async function downloadStockCSV() {
    const { getItems, getCurrentStock } = await import('./data-layer.js');
    const { calcROP, getStatus, daysUntilStockout } = await import('./analytics.js');
    const categoryLabel = { raw_material: 'Сырьё', consumable: 'Расходники', finished_good: 'ГП' };

    let csv = '\uFEFFАртикул;Наименование;Категория;Остаток;Ед.изм;ROP;Статус;Дней до истощения\n';
    getItems().forEach(row => {
        const [art, name, cat, unit] = row;
        csv += `${art};${name};${categoryLabel[cat] || cat};${getCurrentStock(art)};${unit};${calcROP(art)};${getStatus(art)};${daysUntilStockout(art)}\n`;
    });

    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `sklad_${stamp()}.csv`);
}

// Выгрузка журнала движений ТМЦ для сверки с бухгалтерией
export async function downloadMovementsCSV() {
    const { getRecentMovements } = await import('./data-layer.js');
    const typeLabel = { receipt: 'Приход', consumption: 'Расход', sale: 'Продажа', adjustment: 'Корректировка' };

    let csv = '\uFEFFДата;Артикул;Наименование;Тип;Количество;Комментарий\n';
    getRecentMovements(1000).forEach(row => {
        const [mvId, art, date, delta, type, comment, itemName] = row;
        csv += `${date};${art};${itemName || ''};${typeLabel[type] || type};${delta};${(comment || '').replace(/;/g, ',')}\n`;
    });

    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `dvizheniya_${stamp()}.csv`);
}

// Импорт: файл читается в память, валидируется запросом к таблице items,
// и только потом подменяет живую БД — битый файл не остановит конвейер
export async function importSQLite(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const SQL = await initSqlJs({
            locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`
        });
        const newDB = new SQL.Database(buf);
        newDB.exec('SELECT article_id FROM items LIMIT 1;');

        const dbModule = await import('./db.js');
        if (typeof dbModule.setDB === 'function') {
            dbModule.setDB(newDB);
            const { renderAll } = await import('./render.js');
            renderAll();
            alert('✅ База данных импортирована');
        } else {
            alert('⚠️ В db.js нет функции setDB — пришли файл db.js, добавлю одну строку');
        }
    } catch (e) {
        alert('❌ Файл не является базой SQLite: ' + e.message);
    }
    event.target.value = '';
}