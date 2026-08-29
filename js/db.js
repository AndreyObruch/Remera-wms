/* ============================================================
   МОДУЛЬ: db.js
   ОТВЕТСТВЕННОСТЬ: Инициализация SQLite, схема БД, справочники
   РЕАЛЬНОГО профиля ООО «Ремера» (технические и специальные
   канаты: промальп, арамид/HMPE, керамические огнеупорные шнуры,
   яхтенные/рыболовные, протяжка кабеля), генерация 60 дней истории
   ФИЗИКА: БД в памяти браузера (WASM), пересоздаётся для демо.
   Отрицательный остаток невозможен; поставка ≥ недельного расхода.
   ============================================================ */

let db = null;

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

/* ============================================================
   СПРАВОЧНИКИ: реальный профиль производства «Ремера»
   ============================================================ */
function loadReferenceData() {
  // [id, name, lead_time, min_batch, contract]
  const SUPPLIERS = [
    [1, 'КуйбышевАзот (ПА нить)',        7,  500,  'fixed_schedule'],
    [2, 'ТверьПолиэфир (ПЭС нить)',      5,  400,  'fixed_schedule'],
    [3, 'ПолимерТрейд (ПП/ПЭ нить)',     10, 500,  'on_demand'],
    [4, 'РусАр-Тех (арамидная нить)',    14, 100,  'on_demand'],
    [5, 'HMPE-Импорт (Dyneema SK78)',    21, 50,   'on_demand'],
    [6, 'СтеклоВолокно (стекло/базальт)', 8, 150,  'on_demand'],
    [7, 'СиликаПлант (кремнезем)',       12, 100,  'on_demand'],
    [8, 'ТараПлюс (упаковка)',           3,  200,  'on_demand'],
    [9, 'ЛейблПринт',                    4,  5000, 'on_demand']
  ];

  // [article, name, category, unit, avg_daily, safety_days]
  const ITEMS = [
    /* ===== СЫРЬЁ (нити и волокна) ===== */
    ['PA-F',   'Нить полиамидная (капрон)',            'raw_material', 'кг', 150, 3],
    ['PES-F',  'Нить полиэфирная (полиэстер)',         'raw_material', 'кг', 120, 3],
    ['PP-F',   'Нить полипропиленовая',                'raw_material', 'кг', 160, 3],
    ['PE-F',   'Нить полиэтиленовая (HDPE)',           'raw_material', 'кг', 60,  4],
    ['HMPE-F', 'Волокно HMPE (Dyneema SK78)',          'raw_material', 'кг', 15,  7],
    ['ARAM-F', 'Нить арамидная (Русар)',               'raw_material', 'кг', 12,  7],
    ['SIL-F',  'Волокно кремнеземное',                 'raw_material', 'кг', 20,  6],
    ['BAS-R',  'Ровинг базальтовый',                   'raw_material', 'кг', 25,  6],
    ['GLS-R',  'Ровинг стеклянный',                    'raw_material', 'кг', 30,  5],

    /* ===== РАСХОДНИКИ ===== */
    ['BOB-K',   'Бобины картонные',                    'consumable', 'шт', 180, 2],
    ['BOB-P',   'Бобины пластиковые',                  'consumable', 'шт', 80,  2],
    ['SPOOL-L', 'Катушки большие (упаков. верёвки)',   'consumable', 'шт', 15,  3],
    ['LBL-PR',  'Этикетки печатные',                   'consumable', 'шт', 450, 3],
    ['LBL-TAG', 'Бирки с номером партии',              'consumable', 'шт', 300, 3],
    ['PKG-STR', 'Стрейч-плёнка',                       'consumable', 'рул', 15, 5],
    ['PKG-BAG', 'Пакеты ПЭ',                           'consumable', 'шт', 300, 3],
    ['PKG-BOX', 'Коробки картонные',                   'consumable', 'шт', 40,  3],
    ['TAPE-PK', 'Скотч упаковочный',                   'consumable', 'рул', 25, 5],

    /* ===== ГП: Промальп и альпинизм ===== */
    ['STAT-9',   'Верёвка статическая 9мм (ПЭС оплётка)',  'finished_good', 'м', 120, 5],
    ['STAT-10',  'Верёвка статическая 10мм',               'finished_good', 'м', 200, 5],
    ['STAT-105', 'Верёвка статическая 10.5мм',             'finished_good', 'м', 150, 5],
    ['STAT-11',  'Верёвка статическая 11мм',               'finished_good', 'м', 120, 5],
    ['STAT-12',  'Верёвка статическая 12мм',               'finished_good', 'м', 80,  6],
    ['DYN-98',   'Верёвка динамическая 9.8мм',             'finished_good', 'м', 60,  6],
    ['DYN-105',  'Верёвка динамическая 10.5мм',            'finished_good', 'м', 50,  6],
    ['REP-4',    'Репшнур 4мм (ПА)',                       'finished_good', 'м', 300, 4],
    ['REP-6',    'Репшнур 6мм (ПА)',                       'finished_good', 'м', 350, 4],
    ['REP-7',    'Репшнур 7мм (арамид)',                   'finished_good', 'м', 150, 5],
    ['REP-8',    'Репшнур 8мм (ПА)',                       'finished_good', 'м', 200, 4],

    /* ===== ГП: Арамид и HMPE ===== */
    ['ARAM-4',  'Шнур арамидный 4мм',                'finished_good', 'м', 180, 5],
    ['ARAM-6',  'Шнур арамидный 6мм',                'finished_good', 'м', 140, 5],
    ['HMPE-2',  'Канат HMPE 2мм',                    'finished_good', 'м', 400, 5],
    ['HMPE-3',  'Канат HMPE 3мм',                    'finished_good', 'м', 350, 5],
    ['HMPE-4',  'Канат HMPE 4мм',                    'finished_good', 'м', 300, 5],
    ['HMPE-6',  'Канат HMPE 6мм',                    'finished_good', 'м', 200, 5],
    ['HMPE-8',  'Канат HMPE 8мм',                    'finished_good', 'м', 120, 6],
    ['HMPE-10', 'Канат HMPE 10мм',                   'finished_good', 'м', 80,  6],
    ['HMPE-12', 'Канат HMPE 12мм',                   'finished_good', 'м', 50,  7],

    /* ===== ГП: Низкорастяжимые (полиэфир) ===== */
    ['LS-10', 'Канат низкорастяжимый 10мм', 'finished_good', 'м', 150, 5],
    ['LS-12', 'Канат низкорастяжимый 12мм', 'finished_good', 'м', 120, 5],
    ['LS-14', 'Канат низкорастяжимый 14мм', 'finished_good', 'м', 90,  5],
    ['LS-16', 'Канат низкорастяжимый 16мм', 'finished_good', 'м', 70,  6],

    /* ===== ГП: Полиамид общего назначения ===== */
    ['PA-4',  'Канат полиамидный 4мм',  'finished_good', 'м', 500, 3],
    ['PA-6',  'Канат полиамидный 6мм',  'finished_good', 'м', 450, 3],
    ['PA-8',  'Канат полиамидный 8мм',  'finished_good', 'м', 380, 3],
    ['PA-10', 'Канат полиамидный 10мм', 'finished_good', 'м', 300, 4],
    ['PA-12', 'Канат полиамидный 12мм', 'finished_good', 'м', 220, 4],
    ['PA-14', 'Канат полиамидный 14мм', 'finished_good', 'м', 160, 4],
    ['PA-16', 'Канат полиамидный 16мм', 'finished_good', 'м', 120, 5],

    /* ===== ГП: Полипропилен многопрядный ===== */
    ['PP-8',  'Канат ПП 8мм (8-прядный)',   'finished_good', 'м', 400, 3],
    ['PP-10', 'Канат ПП 10мм (12-прядный)', 'finished_good', 'м', 350, 3],
    ['PP-12', 'Канат ПП 12мм (16-прядный)', 'finished_good', 'м', 280, 3],
    ['PP-16', 'Канат ПП 16мм (24-прядный)', 'finished_good', 'м', 200, 4],
    ['PP-20', 'Канат ПП 20мм (32-прядный)', 'finished_good', 'м', 120, 4],
    ['PP-24', 'Канат ПП 24мм (48-прядный)', 'finished_good', 'м', 80,  5],
    ['PP-32', 'Канат ПП 32мм (48-прядный)', 'finished_good', 'м', 40,  5],
    ['PP-40', 'Канат ПП 40мм (48-прядный)', 'finished_good', 'м', 20,  6],

    /* ===== ГП: Полиэтилен ===== */
    ['PE-6',  'Канат полиэтиленовый 6мм',  'finished_good', 'м', 300, 3],
    ['PE-8',  'Канат полиэтиленовый 8мм',  'finished_good', 'м', 250, 3],
    ['PE-10', 'Канат полиэтиленовый 10мм', 'finished_good', 'м', 180, 4],

    /* ===== ГП: Огнеупорные керамические шнуры ===== */
    ['SIL-4',  'Шнур кремнеземный 4мм',            'finished_good', 'м', 150, 5],
    ['SIL-6',  'Шнур кремнеземный 6мм',            'finished_good', 'м', 140, 5],
    ['SIL-8',  'Шнур кремнеземный 8мм',            'finished_good', 'м', 120, 5],
    ['SIL-10', 'Шнур кремнеземный 10мм',           'finished_good', 'м', 100, 6],
    ['SIL-12', 'Шнур кремнеземный 12мм',           'finished_good', 'м', 80,  6],
    ['SIL-14', 'Шнур кремнеземный 14мм',           'finished_good', 'м', 60,  6],
    ['SIL-16', 'Шнур кремнеземный 16мм',           'finished_good', 'м', 45,  7],
    ['SIL-18', 'Шнур кремнеземный 18мм',           'finished_good', 'м', 30,  7],
    ['BAS-6',  'Шнур базальтовый 6мм (до 500°C)',  'finished_good', 'м', 130, 5],
    ['BAS-8',  'Шнур базальтовый 8мм (сердечник)', 'finished_good', 'м', 110, 5],
    ['BAS-10', 'Шнур базальтовый 10мм (сердечник)','finished_good', 'м', 90,  6],
    ['BAS-12', 'Шнур базальтовый 12мм',            'finished_good', 'м', 70,  6],
    ['GLS-4',  'Шнур стеклянный 4мм',              'finished_good', 'м', 120, 5],
    ['GLS-6',  'Шнур стеклянный 6мм',              'finished_good', 'м', 100, 5],
    ['GLS-8',  'Шнур стеклянный 8мм',              'finished_good', 'м', 80,  5],
    ['GLS-10', 'Шнур стеклянный 10мм',             'finished_good', 'м', 60,  6],

    /* ===== ГП: Специальные применения ===== */
    ['FISH-18',  'Шнур рыболовный (throwline) 1.8мм', 'finished_good', 'м', 600, 3],
    ['FISH-25',  'Шнур рыболовный 2.5мм',             'finished_good', 'м', 400, 3],
    ['FISH-3',   'Шнур рыболовный 3мм',               'finished_good', 'м', 300, 3],
    ['YAHT-6',   'Канат яхтенный (шкоты) 6мм',        'finished_good', 'м', 250, 4],
    ['YAHT-8',   'Канат яхтенный 8мм',                'finished_good', 'м', 200, 4],
    ['YAHT-10',  'Канат яхтенный (фалы) 10мм',        'finished_good', 'м', 150, 5],
    ['YAHT-12',  'Канат яхтенный 12мм',               'finished_good', 'м', 100, 5],
    ['LEER-5',   'Леер для лодок 5мм',                'finished_good', 'м', 200, 4],
    ['LEER-6',   'Леер для лодок 6мм',                'finished_good', 'м', 150, 4],
    ['LEER-8',   'Леер для лодок 8мм',                'finished_good', 'м', 100, 5],
    ['CABLE-4',  'Канат для протяжки кабеля 4мм',     'finished_good', 'м', 250, 4],
    ['CABLE-6',  'Канат для протяжки кабеля 6мм',     'finished_good', 'м', 180, 4],
    ['CABLE-8',  'Трос-лидер 8мм',                    'finished_good', 'м', 120, 5],
    ['FENCE-6',  'Канат ограждающий 6мм',             'finished_good', 'м', 300, 3],
    ['FENCE-8',  'Канат ограждающий 8мм',             'finished_good', 'м', 250, 3],
    ['FENCE-10', 'Канат ограждающий 10мм',            'finished_good', 'м', 180, 4],
    ['CARGO-16', 'Канат грузовой 16мм',               'finished_good', 'м', 150, 5],
    ['CARGO-20', 'Канат грузовой 20мм',               'finished_good', 'м', 100, 5],
    ['CARGO-24', 'Канат грузовой 24мм',               'finished_good', 'м', 60,  6],
    ['BAG-4',    'Шнур для пакетов 4мм',              'finished_good', 'м', 800, 2],
    ['BAG-5',    'Шнур для пакетов 5мм',              'finished_good', 'м', 600, 2],
    ['BANNER-3', 'Шнур баннерный 3мм',                'finished_good', 'м', 500, 3],
    ['BANNER-4', 'Шнур баннерный 4мм',                'finished_good', 'м', 400, 3],
    ['HORSE-8',  'Шнур конный спорт 8мм',             'finished_good', 'м', 150, 5],
    ['HORSE-10', 'Шнур конный спорт 10мм',            'finished_good', 'м', 120, 5],
    ['PACK-10',  'Верёвка упакованная 10мм (бухты)',  'finished_good', 'м', 400, 3]
  ];

  // [article, supplier_id] — основное сырьё и расходники
  const LINKS = [
    ['PA-F',1],['PES-F',2],['PP-F',3],['PE-F',3],['HMPE-F',5],['ARAM-F',4],
    ['SIL-F',7],['BAS-R',6],['GLS-R',6],
    ['BOB-K',8],['BOB-P',8],['SPOOL-L',8],['PKG-STR',8],['PKG-BAG',8],
    ['PKG-BOX',8],['TAPE-PK',8],['LBL-PR',9],['LBL-TAG',9]
  ];

  SUPPLIERS.forEach(r => db.run(`INSERT INTO suppliers VALUES (${r[0]},'${r[1]}',${r[2]},${r[3]},'${r[4]}')`));
  ITEMS.forEach(r => db.run(`INSERT INTO items VALUES ('${r[0]}','${r[1]}','${r[2]}','${r[3]}',${r[4]},${r[5]})`));
  LINKS.forEach(r => db.run(`INSERT INTO item_suppliers VALUES ('${r[0]}',${r[1]},1)`));
}

/* ============================================================
   ГЕНЕРАЦИЯ 60 ДНЕЙ ИСТОРИИ (физичная, без отрицательных)
   ============================================================ */
function generateHistoricalData() {
  const today = new Date();
  const rows = db.exec(`SELECT article_id, category, avg_daily_consumption FROM items`)[0].values;

  const balance = {};
  rows.forEach(([art, cat]) => {
    balance[art] = Math.round(cat === 'finished_good' ? 2000 + Math.random() * 4000 : 1000 + Math.random() * 1500);
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
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    rows.forEach(([art, cat, avg]) => {
      if (cat === 'raw_material' || cat === 'consumable') {
        const want = Math.round(avg * (0.8 + Math.random() * 0.4) * 10) / 10;
        const qty = Math.min(want, balance[art]);
        if (qty > 0) push(art, dateStr, -qty, 'consumption', 'Расход в производство');
      }
      if (cat === 'finished_good') {
        push(art, dateStr, Math.round(avg * (0.9 + Math.random() * 0.3)), 'receipt', 'Производство (плетение)');
        if (Math.random() > 0.3) {
          const sale = Math.min(Math.round(avg * (0.5 + Math.random() * 0.7)), balance[art]);
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
        const qty = Math.round(Math.max(minBatch, avg * 7) * (1 + Math.random() * 0.5));
        push(art, dateStr, qty, 'receipt', 'Поступление от поставщика');
      });
    }
  }
}

export function getDB() { return db; }
export function setDB(newDB) { db = newDB; }
export function countRows() {
  try { return db.exec(`SELECT COUNT(*) FROM inventory_movements`)[0].values[0][0]; }
  catch { return 0; }
}