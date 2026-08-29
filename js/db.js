/* ============================================================
   МОДУЛЬ: db.js
   ОТВЕТСТВЕННОСТЬ: Инициализация SQLite, схема БД,
   загрузка справочников (реалистичная номенклатура канатного
   завода — ~90 позиций, ГОСТ 30055-93), генерация 60 дней истории
   ФИЗИКА ПРОЦЕССА: БД живёт в памяти браузера через WASM,
   при перезагрузке пересоздаётся для демо-целей.
   Отрицательный остаток невозможен: расход ограничен текущим
   балансом. Поставка ≥ недельного потребления, иначе склад
   хронически голодает.
   ============================================================ */

let db = null;

/*
 * Инициализация SQLite через SQL.js (WASM)
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
 * Физика: номенклатура соответствует ГОСТ 30055-93 (канаты тросовой
   и якорной свивки). Поставщики — реальные российские производители
   канатного сырья и упаковки.
 */
function loadReferenceData() {
  db.run(`
    INSERT INTO suppliers VALUES
      (1, 'Клинский канатный завод',    7,  500,  'fixed_schedule'),
      (2, 'Канат-Коломна',              8,  400,  'fixed_schedule'),
      (3, 'ТверьПолиэфир',              5,  300,  'fixed_schedule'),
      (4, 'ПолимерТрейд (ПП/джут)',     10, 400,  'on_demand'),
      (5, 'ТараПлюс (упаковка)',        3,  200,  'on_demand'),
      (6, 'ЛейблПринт',                 4,  5000, 'on_demand'),
      (7, 'МетизТрейд (проволока)',     12, 200,  'on_demand'),
      (8, 'ЛенВолокно (Кострома)',      6,  150,  'on_demand');

    INSERT INTO items VALUES
      /* ====== СЫРЬЁ ====== */
      ('PA-187',   'Нить полиамидная 187 текс (ГОСТ)',       'raw_material', 'кг', 80,  3),
      ('PA-935',   'Нить полиамидная 935 текс (ГОСТ)',       'raw_material', 'кг', 140, 3),
      ('PA-1870',  'Нить полиамидная 1870 текс (ГОСТ)',      'raw_material', 'кг', 60,  3),
      ('PES-500',  'Нить полиэфирная 500 текс (ГОСТ)',       'raw_material', 'кг', 50,  3),
      ('PES-1000', 'Нить полиэфирная 1000 текс (ГОСТ)',      'raw_material', 'кг', 90,  3),
      ('PP-500',   'Нить полипропиленовая 500 текс',         'raw_material', 'кг', 60,  4),
      ('PP-1100',  'Нить полипропиленовая 1100 текс',        'raw_material', 'кг', 120, 3),
      ('PP-250',   'Нить полипропиленовая 250 текс',         'raw_material', 'кг', 40,  4),
      ('JUTE-F',   'Джут волокно (Бангладеш)',               'raw_material', 'кг', 25,  5),
      ('MANILA-F', 'Манильская пенька',                      'raw_material', 'кг', 15,  5),
      ('STL-W',    'Проволока стальная оцинкованная 1.2мм',  'raw_material', 'кг', 35,  7),
      ('LIN-F',    'Льняное волокно (костра)',               'raw_material', 'кг', 30,  4),

      /* ====== РАСХОДНИКИ ====== */
      ('BOB-K',    'Бобины картонные d=160мм',               'consumable', 'шт', 180, 2),
      ('BOB-P',    'Бобины пластиковые d=200мм',             'consumable', 'шт', 80,  2),
      ('SPUL-M',   'Шпули металлические (ткацкие)',          'consumable', 'шт', 30,  3),
      ('SPOOL-L',  'Катушки большие (для каната d=20+мм)',   'consumable', 'шт', 12,  3),
      ('LBL-PR',   'Этикетки печатные с логотипом',          'consumable', 'шт', 450, 3),
      ('LBL-TAG',  'Бирки пластиковые с номером партии',     'consumable', 'шт', 300, 3),
      ('PKG-STR',  'Стрейч-плёнка 500мм × 300м',             'consumable', 'рул', 15, 5),
      ('PKG-BAG',  'Пакеты ПЭ 400×600мм',                    'consumable', 'шт', 300, 3),
      ('PKG-BOX',  'Коробки картонные 600×400×300',          'consumable', 'шт', 40,  3),
      ('TAPE-PK',  'Скотч упаковочный 48мм × 66м',           'consumable', 'рул', 25, 5),
      ('TIE-CB',   'Стяжки кабельные 200мм',                 'consumable', 'уп', 8,   5),
      ('LUB-R',    'Смазка редукторная (станки)',            'consumable', 'л',  3,   14),

      /* ====== ГОТОВАЯ ПРОДУКЦИЯ ====== */
      /* Канаты полиамидные тросовой свивки (ПАТ) — ГОСТ 30055-93 */
      ('PAT-6',    'Канат ПАТ-6 (d=6мм, 3-прядный)',         'finished_good', 'м', 420, 4),
      ('PAT-8',    'Канат ПАТ-8 (d=8мм, 3-прядный)',         'finished_good', 'м', 340, 4),
      ('PAT-10',   'Канат ПАТ-10 (d=10мм, 3-прядный)',       'finished_good', 'м', 280, 5),
      ('PAT-12',   'Канат ПАТ-12 (d=12мм, 3-прядный)',       'finished_good', 'м', 220, 5),
      ('PAT-14',   'Канат ПАТ-14 (d=14мм, 3-прядный)',       'finished_good', 'м', 160, 5),
      ('PAT-16',   'Канат ПАТ-16 (d=16мм, 3-прядный)',       'finished_good', 'м', 140, 5),
      ('PAT-18',   'Канат ПАТ-18 (d=18мм, 3-прядный)',       'finished_good', 'м', 110, 5),
      ('PAT-20',   'Канат ПАТ-20 (d=20мм, 3-прядный)',       'finished_good', 'м', 95,  6),
      ('PAT-22',   'Канат ПАТ-22 (d=22мм, 3-прядный)',       'finished_good', 'м', 80,  6),
      ('PAT-24',   'Канат ПАТ-24 (d=24мм, 3-прядный)',       'finished_good', 'м', 70,  6),
      ('PAT-26',   'Канат ПАТ-26 (d=26мм, 3-прядный)',       'finished_good', 'м', 60,  7),

      /* Канаты полипропиленовые (ПП) — ГОСТ 30055-93 */
      ('PP-6',     'Канат ПП-6 (d=6мм, 3-прядный)',          'finished_good', 'м', 480, 3),
      ('PP-8',     'Канат ПП-8 (d=8мм, 3-прядный)',          'finished_good', 'м', 360, 3),
      ('PP-10',    'Канат ПП-10 (d=10мм, 3-прядный)',        'finished_good', 'м', 280, 3),
      ('PP-12',    'Канат ПП-12 (d=12мм, 3-прядный)',        'finished_good', 'м', 240, 3),
      ('PP-14',    'Канат ПП-14 (d=14мм, 3-прядный)',        'finished_good', 'м', 180, 4),
      ('PP-16',    'Канат ПП-16 (d=16мм, 3-прядный)',        'finished_good', 'м', 140, 4),
      ('PP-18',    'Канат ПП-18 (d=18мм, 3-прядный)',        'finished_good', 'м', 110, 4),
      ('PP-20',    'Канат ПП-20 (d=20мм, 3-прядный)',        'finished_good', 'м', 90,  5),
      ('PP-24',    'Канат ПП-24 (d=24мм, 3-прядный)',        'finished_good', 'м', 70,  5),
      ('PP-28',    'Канат ПП-28 (d=28мм, 3-прядный)',        'finished_good', 'м', 55,  6),

      /* Канаты полиэфирные (ПЭТ) — высокопрочные */
      ('PET-8',    'Канат ПЭТ-8 (d=8мм, 3-прядный)',         'finished_good', 'м', 180, 5),
      ('PET-10',   'Канат ПЭТ-10 (d=10мм, 3-прядный)',       'finished_good', 'м', 140, 5),
      ('PET-12',   'Канат ПЭТ-12 (d=12мм, 3-прядный)',       'finished_good', 'м', 110, 5),
      ('PET-14',   'Канат ПЭТ-14 (d=14мм, 3-прядный)',       'finished_good', 'м', 90,  5),
      ('PET-16',   'Канат ПЭТ-16 (d=16мм, 3-прядный)',       'finished_good', 'м', 70,  6),
      ('PET-18',   'Канат ПЭТ-18 (d=18мм, 3-прядный)',       'finished_good', 'м', 55,  6),

      /* Канаты натуральные (джутовые, манильские) */
      ('JUTE-8',   'Канат джутовый 8мм (3-прядный)',         'finished_good', 'м', 180, 4),
      ('JUTE-10',  'Канат джутовый 10мм (3-прядный)',        'finished_good', 'м', 140, 4),
      ('JUTE-12',  'Канат джутовый 12мм (3-прядный)',        'finished_good', 'м', 100, 5),
      ('MAN-12',   'Канат манильский 12мм',                  'finished_good', 'м', 40,  6),
      ('MAN-16',   'Канат манильский 16мм',                  'finished_good', 'м', 25,  7),

      /* Шнуры плетёные (8-прядные) */
      ('BR-PA-4',  'Шнур плетёный ПА 4мм (8-прядный)',       'finished_good', 'м', 280, 3),
      ('BR-PA-6',  'Шнур плетёный ПА 6мм (8-прядный)',       'finished_good', 'м', 220, 3),
      ('BR-PA-8',  'Шнур плетёный ПА 8мм (8-прядный)',       'finished_good', 'м', 170, 4),
      ('BR-PA-10', 'Шнур плетёный ПА 10мм (8-прядный)',      'finished_good', 'м', 130, 4),
      ('BR-PA-12', 'Шнур плетёный ПА 12мм (8-прядный)',      'finished_good', 'м', 90,  4),
      ('BR-PP-4',  'Шнур плетёный ПП 4мм (8-прядный)',       'finished_good', 'м', 320, 3),
      ('BR-PP-6',  'Шнур плетёный ПП 6мм (8-прядный)',       'finished_good', 'м', 260, 3),
      ('BR-PP-8',  'Шнур плетёный ПП 8мм (8-прядный)',       'finished_good', 'м', 190, 4),
      ('BR-PP-10', 'Шнур плетёный ПП 10мм (8-прядный)',      'finished_good', 'м', 150, 4),

      /* Шнуры кручёные (хозяйственные) */
      ('TW-PA-3',  'Шнур кручёный ПА 3мм',                   'finished_good', 'м', 500, 2),
      ('TW-PA-5',  'Шнур кручёный ПА 5мм',                   'finished_good', 'м', 380, 2),
      ('TW-PP-3',  'Шнур кручёный ПП 3мм',                   'finished_good', 'м', 550, 2),
      ('TW-PP-5',  'Шнур кручёный ПП 5мм',                   'finished_good', 'м', 420, 2),

      /* Шпагаты */
      ('TW-J1',    'Шпагат джутовый 1-ниточный',             'finished_good', 'кг', 80,  4),
      ('TW-J2',    'Шпагат джутовый 2-ниточный',             'finished_good', 'кг', 60,  4),
      ('TW-J3',    'Шпагат джутовый 3-ниточный',             'finished_good', 'кг', 40,  5),
      ('TW-PP1',   'Шпагат полипропиленовый 1-ниточный',     'finished_good', 'кг', 120, 3),
      ('TW-PP2',   'Шпагат полипропиленовый 2-ниточный',     'finished_good', 'кг', 90,  3),
      ('TW-LN',    'Шпагат льняной (Кострома)',              'finished_good', 'кг', 50,  5),

      /* Верёвки натуральные (для яхт, декор) */
      ('R-COT-8',  'Верёвка хлопковая 8мм',                  'finished_good', 'м', 90,  5),
      ('R-COT-10', 'Верёвка хлопковая 10мм',                 'finished_good', 'м', 70,  5),

      /* Тросы стальные оцинкованные */
      ('T-STL-3',  'Трос стальной оцинк. 3мм (7×7)',         'finished_good', 'м', 120, 7),
      ('T-STL-5',  'Трос стальной оцинк. 5мм (7×7)',         'finished_good', 'м', 90,  7),
      ('T-STL-8',  'Трос стальной оцинк. 8мм (6×19)',        'finished_good', 'м', 60,  7),
      ('T-STL-10', 'Трос стальной оцинк. 10мм (6×19)',       'finished_good', 'м', 40,  7),

      /* Специальные изделия */
      ('SLING-2T', 'Строп петлевой 2т (ПЭТ)',                'finished_good', 'шт', 25,  7),
      ('SLING-5T', 'Строп петлевой 5т (ПЭТ)',                'finished_good', 'шт', 15,  7),
      ('NET-CARGO','Сетка грузовая 3×4м (ПП)',               'finished_good', 'шт', 8,   10);

    /* Связи: кто основной поставщик для какого сырья/расходника */
    INSERT INTO item_suppliers VALUES
      /* Сырьё */
      ('PA-187',   1, 1),
      ('PA-935',   1, 1),
      ('PA-1870',  1, 1),
      ('PES-500',  3, 1),
      ('PES-1000', 3, 1),
      ('PP-500',   4, 1),
      ('PP-1100',  4, 1),
      ('PP-250',   4, 1),
      ('JUTE-F',   4, 1),
      ('MANILA-F', 4, 1),
      ('STL-W',    7, 1),
      ('LIN-F',    8, 1),
      /* Расходники */
      ('BOB-K',    5, 1),
      ('BOB-P',    5, 1),
      ('SPUL-M',   5, 1),
      ('SPOOL-L',  5, 1),
      ('PKG-STR',  5, 1),
      ('PKG-BAG',  5, 1),
      ('PKG-BOX',  5, 1),
      ('TAPE-PK',  5, 1),
      ('TIE-CB',   5, 1),
      ('LUB-R',    5, 1),
      ('LBL-PR',   6, 1),
      ('LBL-TAG',  6, 1);
  `);
}

/*
 * Генерация 60 дней исторических данных
 * Физика: завод работает в будние дни. Каждая проводка сразу
 * меняет баланс. Поставка ≥ недельного потребления.
 */
function generateHistoricalData() {
  const today = new Date();
  const rows = db.exec(`SELECT article_id, category, avg_daily_consumption FROM items`)[0].values;

  // Стартовые остатки
  const balance = {};
  rows.forEach(([art, cat]) => {
    balance[art] = Math.round(cat === 'finished_good' ? 2500 + Math.random() * 4000 : 1200 + Math.random() * 1500);
    db.run(`INSERT INTO inventory_movements (article_id, movement_date, delta_qty, movement_type, comment)
            VALUES ('${art}', date('now','-60 days'), ${balance[art]}, 'adjustment', 'Стартовый остаток')`);
  });

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
    if (isWeekend) continue;

    rows.forEach(([art, cat, avg]) => {
      if (cat === 'raw_material' || cat === 'consumable') {
        const want = Math.round(avg * (0.8 + Math.random() * 0.4) * 10) / 10;
        const qty = Math.min(want, balance[art]);
        if (qty > 0) push(art, dateStr, -qty, 'consumption', 'Расход в производство');
      }

      if (cat === 'finished_good') {
        const prod = Math.round(avg * (0.9 + Math.random() * 0.3));
        push(art, dateStr, prod, 'receipt', 'Производство (плетение/кручение)');

        if (Math.random() > 0.3) {
          const wantSale = Math.round(avg * (0.5 + Math.random() * 0.7));
          const sale = Math.min(wantSale, balance[art]);
          if (sale > 0) push(art, dateStr, -sale, 'sale', 'Отгрузка клиенту');
        }
      }
    });

    if (d % 7 === 0) {
      const sup = db.exec(`
        SELECT i.article_id, s.min_batch_qty, i.avg_daily_consumption
        FROM items i
        JOIN item_suppliers isp ON isp.article_id = i.article_id AND isp.is_primary = 1
        JOIN suppliers s ON s.supplier_id = isp.supplier_id
      `)[0].values;
      sup.forEach(([art, minBatch, avg]) => {
        const weekNeed = avg * 7;
        const base = Math.max(minBatch, weekNeed);
        const qty = Math.round(base * (1 + Math.random() * 0.5));
        push(art, dateStr, qty, 'receipt', 'Поступление от поставщика');
      });
    }
  }
}

export function getDB() {
  return db;
}

export function setDB(newDB) {
  db = newDB;
}

export function countRows() {
  try { return db.exec(`SELECT COUNT(*) FROM inventory_movements`)[0].values[0][0]; }
  catch { return 0; }
}