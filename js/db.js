/* ============================================================
   МОДУЛЬ: db.js
   ОТВЕТСТВЕННОСТЬ: Инициализация SQLite, схема БД,
   загрузка справочников (реальная номенклатура канатного
   производства), генерация исторических данных
   ФИЗИКА ПРОЦЕССА: БД живёт в памяти браузера через WASM,
   при перезагрузке страницы пересоздаётся для демо-целей.
   Отрицательный остаток невозможен: расход ограничен текущим
   балансом (нельзя отгрузить то, чего физически нет на складе)
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
 * Физика: номенклатура соответствует реальному канатному
   производству (ГОСТ 30055-93, тросовая свивка 3 пряди)
 */
function loadReferenceData() {
  db.run(`
    INSERT INTO suppliers VALUES
      (1, 'КурскХимВолокно',      7,  500,  'fixed_schedule'),
      (2, 'ТверьПолиэфир',        5,  300,  'fixed_schedule'),
      (3, 'ПолимерТрейд (ПП/джут)', 10, 400, 'on_demand'),
      (4, 'ТараПлюс (упаковка)',  3,  200,  'on_demand'),
      (5, 'ЛейблПринт',           4,  5000, 'on_demand');

    INSERT INTO items VALUES
      ('PA-935',   'Нить полиамидная 935 текс',        'raw_material',  'кг', 80,  3),
      ('PA-187',   'Нить полиамидная 187 текс',        'raw_material',  'кг', 40,  3),
      ('PES-1000', 'Нить полиэфирная 1000 текс',       'raw_material',  'кг', 60,  3),
      ('PP-1100',  'Нить полипропиленовая 1100 текс',  'raw_material',  'кг', 90,  3),
      ('PP-500',   'Нить полипропиленовая 500 текс',   'raw_material',  'кг', 50,  4),
      ('JUTE-F',   'Джут волокно (Бангладеш)',         'raw_material',  'кг', 20,  5),
      ('BOB-K',    'Бобины картонные',                 'consumable',    'шт', 150, 2),
      ('LBL-PR',   'Этикетки печатные',                'consumable',    'шт', 400, 3),
      ('PKG-STR',  'Стрейч-плёнка',                    'consumable',    'рул', 12, 5),
      ('PKG-BAG',  'Пакеты ПЭ для упаковки',           'consumable',    'шт', 250, 3),
      ('PAT-10',   'Канат полиамидный ПАТ-10 (d=10мм)', 'finished_good', 'м', 220, 5),
      ('PAT-16',   'Канат полиамидный ПАТ-16 (d=16мм)', 'finished_good', 'м', 110, 5),
      ('PP-8',     'Канат полипропиленовый ПП-8 (d=8мм)', 'finished_good', 'м', 300, 4),
      ('PP-12',    'Канат полипропиленовый ПП-12 (d=12мм)', 'finished_good', 'м', 260, 4),
      ('PP-16',    'Канат полипропиленовый ПП-16 (d=16мм)', 'finished_good', 'м', 150, 5),
      ('CORD-6',   'Шнур универсальный 6 мм',          'finished_good', 'м', 380, 4),
      ('BR-4',     'Шнур плетёный ПА 4 мм (8-прядный)', 'finished_good', 'м', 200, 4),
      ('BR-PP6',   'Шнур плетёный ПП 6 мм',            'finished_good', 'м', 240, 4),
      ('TW-J2',    'Шпагат джутовый 2-ниточный',       'finished_good', 'кг', 60, 5),
      ('TW-PP',    'Шпагат полипропиленовый',          'finished_good', 'кг', 80, 4);

    INSERT INTO item_suppliers VALUES
      ('PA-935', 1, 1),
      ('PA-187', 1, 1),
      ('PES-1000', 2, 1),
      ('PP-1100', 3, 1),
      ('PP-500', 3, 1),
      ('JUTE-F', 3, 1),
      ('BOB-K', 4, 1),
      ('PKG-STR', 4, 1),
      ('PKG-BAG', 4, 1),
      ('LBL-PR', 5, 1);
  `);
}

/*
 * Генерация 60 дней исторических данных
 * Физика: цех плетёт в будни, выходные — простой.
 * Защита от отрицательного остатка: расход и отгрузка ограничены
 * текущим балансом (нельзя списать больше, чем лежит на складе).
 * Готовая продукция пополняется ежедневной выработкой станков.
 */
function generateHistoricalData() {
  const today = new Date();
  const rows = db.exec(`SELECT article_id, category, avg_daily_consumption FROM items`)[0].values;

  // Стартовые остатки: фиксация начального баланса склада
  const balance = {};
  rows.forEach(([art, cat]) => {
    balance[art] = Math.round(cat === 'finished_good' ? 3000 + Math.random() * 4000 : 1500 + Math.random() * 1500);
    db.run(`INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment)
            VALUES ('${art}', date('now','-60 days'), ${balance[art]}, 'adjustment', 'Стартовый остаток')`);
  });

  // Каждая проводка сразу меняет баланс — так остаток всегда физичен
  const push = (art, dateStr, qty, type, comment) => {
    db.run(`INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment)
            VALUES ('${art}','${dateStr}',${qty},'${type}','${comment}')`);
    balance[art] += qty;
  };

  for (let d = 60; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) continue; // цех не работает в выходные

    rows.forEach(([art, cat, avg]) => {
      if (cat === 'raw_material' || cat === 'consumable') {
        // Расход сырья в производство, ограничен остатком
        const want = Math.round(avg * (0.8 + Math.random() * 0.4) * 10) / 10;
        const qty = Math.min(want, balance[art]);
        if (qty > 0) push(art, dateStr, -qty, 'consumption', 'Расход в производство');
      }

      if (cat === 'finished_good') {
        // Выработка станков пополняет склад готовой продукции
        const prod = Math.round(avg * (0.9 + Math.random() * 0.3));
        push(art, dateStr, prod, 'receipt', 'Производство (плетение)');

        // Отгрузка клиенту — не больше физического остатка
        if (Math.random() > 0.3) {
          const wantSale = Math.round(avg * (0.5 + Math.random() * 0.7));
          const sale = Math.min(wantSale, balance[art]);
          if (sale > 0) push(art, dateStr, -sale, 'sale', 'Отгрузка клиенту');
        }
      }
    });

    // Поставки сырья раз в неделю, минимальной партией по договору
    if (d % 7 === 0) {
      const sup = db.exec(`
        SELECT i.article_id, s.min_batch_qty FROM items i
        JOIN item_suppliers isp ON isp.article_id = i.article_id AND isp.is_primary = 1
        JOIN suppliers s ON s.supplier_id = isp.supplier_id
      `)[0].values;
      sup.forEach(([art, minBatch]) => {
        const qty = minBatch * (1 + Math.floor(Math.random() * 2));
        push(art, dateStr, qty, 'receipt', 'Поступление от поставщика');
      });
    }
  }
}

/*
 * Экспорт экземпляра БД для других модулей
 */
export function getDB() {
  return db;
}

/*
 * Подмена экземпляра БД (используется при импорте SQLite-файла).
 * Физика: пользователь загрузил снимок состояния склада со своего
 * компьютера — подменяем живую БД импортированной без перезапуска приложения
 */
export function setDB(newDB) {
  db = newDB;
}

/*
 * Подсчёт строк в таблице движений
 */
export function countRows() {
  try { return db.exec(`SELECT COUNT(*) FROM inventory_movements`)[0].values[0][0]; }
  catch { return 0; }
}