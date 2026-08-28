/* ============================================================
   МОДУЛЬ: db.js
   ОТВЕТСТВЕННОСТЬ: Инициализация SQLite, схема БД, 
   загрузка справочников, генерация исторических данных
   ФИЗИКА ПРОЦЕССА: БД живёт в памяти браузера через WASM,
   при перезагрузке страницы пересоздаётся для демо-целей
   ============================================================ */

let db = null;

/*
 * Инициализация SQLite через SQL.js (WASM)
 * Физика: загружаем бинарник SQLite из CDN, создаём экземпляр БД
 */
export async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });
    db = new SQL.Database();
    
    createSchema();
    loadReferenceData();
    generateHistoricalData();
    
    return db;
  } catch (e) {
    console.error('Ошибка инициализации БД:', e);
    throw e;
  }
}

/*
 * Создание схемы БД
 * Физика: 4 таблицы отражают реальный складской учёт
 */
function createSchema() {
  db.run(`
    CREATE TABLE suppliers (
      supplier_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      lead_time_days INTEGER NOT NULL,
      min_batch_qty REAL NOT NULL,
      contract_type TEXT CHECK (contract_type IN ('fixed_schedule', 'on_demand'))
    );

    CREATE TABLE items (
      article_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT CHECK (category IN ('raw_material', 'consumable', 'finished_good')),
      unit TEXT NOT NULL,
      avg_daily_consumption REAL DEFAULT 0,
      safety_stock_days REAL DEFAULT 3
    );

    CREATE TABLE item_suppliers (
      article_id TEXT REFERENCES items(article_id),
      supplier_id INTEGER REFERENCES suppliers(supplier_id),
      is_primary INTEGER DEFAULT 0,
      PRIMARY KEY (article_id, supplier_id)
    );

    CREATE TABLE inventory_movements (
      movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT REFERENCES items(article_id),
      movement_date TEXT NOT NULL,
      delta_qty REAL NOT NULL,
      movement_type TEXT CHECK (movement_type IN ('receipt', 'consumption', 'sale', 'adjustment')),
      comment TEXT
    );

    CREATE INDEX idx_movements_article ON inventory_movements(article_id, movement_date);
  `);
}

/*
 * Загрузка справочных данных
 * Физика: поставщики, номенклатура, связи ТМЦ-поставщик
 */
function loadReferenceData() {
  db.run(`
    INSERT INTO suppliers VALUES
      (1, 'ООО Химпром',        7,  500, 'fixed_schedule'),
      (2, 'ООО Полимер',        10, 300, 'on_demand'),
      (3, 'ООО Тара',           3,  500, 'fixed_schedule'),
      (4, 'ООО Синтетика СПб',  5,  200, 'on_demand');

    INSERT INTO items VALUES
      ('POLY-1000', 'Полиэстер 1000D',         'raw_material', 'кг', 120, 3),
      ('POLY-500',  'Полиамид 500D',           'raw_material', 'кг', 60,  4),
      ('PPRO-800',  'Полипропилен 800D',       'raw_material', 'кг', 90,  3),
      ('BOB-PL',    'Бобины пластиковые',      'consumable',   'шт', 180, 2),
      ('PKG-STR',   'Стрейч-плёнка',           'consumable',   'рул', 15, 5),
      ('LBL-PR',    'Этикетки печатные',       'consumable',   'шт', 400, 3),
      ('ROPE-10',   'Канат полипропиленовый 10 мм', 'finished_good', 'м', 250, 5),
      ('ROPE-16',   'Канат полиамидный 16 мм',      'finished_good', 'м', 120, 5),
      ('CORD-6',    'Шнур универсальный 6 мм',      'finished_good', 'м', 380, 4),
      ('SLING-2T',  'Строп петлевой 2т',            'finished_good', 'шт', 40,  7);

    INSERT INTO item_suppliers VALUES
      ('POLY-1000', 1, 1),
      ('POLY-500',  2, 1),
      ('PPRO-800',  4, 1),
      ('BOB-PL',    3, 1),
      ('PKG-STR',   3, 1),
      ('LBL-PR',    3, 1);
  `);
}

/*
 * Генерация 60 дней исторических данных
 * Физика: реалистичная история с учётом выходных, сезонности,
 * договорных условий поставок (мин. партии, lead_time)
 */
function generateHistoricalData() {
  const today = new Date();
  const rawMaterials = db.exec(`SELECT article_id, avg_daily_consumption FROM items WHERE category='raw_material'`)[0].values;
  const consumables  = db.exec(`SELECT article_id, avg_daily_consumption FROM items WHERE category='consumable'`)[0].values;
  const finished     = db.exec(`SELECT article_id, avg_daily_consumption FROM items WHERE category='finished_good'`)[0].values;

  const insertMovements = [];

  for (let d = 60; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (!isWeekend) {
      rawMaterials.forEach(([art, avg]) => {
        const noise = 0.8 + Math.random() * 0.4;
        const qty = Math.round(avg * noise * 10) / 10;
        insertMovements.push(`('${art}','${dateStr}',${-qty},'consumption','Расход в производство')`);
      });
      
      consumables.forEach(([art, avg]) => {
        const noise = 0.7 + Math.random() * 0.6;
        const qty = Math.round(avg * noise);
        insertMovements.push(`('${art}','${dateStr}',${-qty},'consumption','Расход в производство')`);
      });
    }

    if (!isWeekend && Math.random() > 0.3) {
      finished.forEach(([art, avg]) => {
        if (Math.random() > 0.5) {
          const qty = Math.round(avg * (0.3 + Math.random() * 0.7));
          insertMovements.push(`('${art}','${dateStr}',${-qty},'sale','Отгрузка клиенту')`);
        }
      });
    }

    if (d % 7 === 0) {
      rawMaterials.forEach(([art]) => {
        const sup = db.exec(`SELECT s.min_batch_qty FROM item_suppliers i JOIN suppliers s ON i.supplier_id=s.supplier_id WHERE i.article_id='${art}' AND i.is_primary=1`)[0];
        if (sup) {
          const minBatch = sup.values[0][0];
          const qty = minBatch * (1 + Math.floor(Math.random() * 3));
          insertMovements.push(`('${art}','${dateStr}',${qty},'receipt','Поступление от поставщика')`);
        }
      });
    }
  }

  for (let i = 0; i < insertMovements.length; i += 100) {
    const batch = insertMovements.slice(i, i + 100).join(',');
    db.run(`INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment) VALUES ${batch}`);
  }

  const allItems = db.exec(`SELECT article_id, category FROM items`)[0].values;
  allItems.forEach(([art, cat]) => {
    const initial = cat === 'finished_good' ? 3000 + Math.random() * 4000 : 1500 + Math.random() * 1500;
    db.run(`INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment)
            VALUES ('${art}', date('now', '-60 days'), ${Math.round(initial)}, 'adjustment', 'Стартовый остаток')`);
  });
}

/*
 * Экспорт экземпляра БД для других модулей
 */
export function getDB() {
  return db;
}

/*
 * Подсчёт строк в таблице движений
 */
export function countRows() {
  try { return db.exec(`SELECT COUNT(*) FROM inventory_movements`)[0].values[0][0]; }
  catch { return 0; }
}