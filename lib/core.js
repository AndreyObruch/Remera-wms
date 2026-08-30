// lib/core.js — WMS «РЕМЕРА» v2: доменное ядро (единый источник правды).
// Логика извлечена из шлюзов v1 (max.js / telegram.js).
// Внешние мессенджеры из основного контура исключены.

export const NOMENCLATURE = {
  'PA-F': 'Нить полиамидная (капрон)', 'PES-F': 'Нить полиэфирная',
  'PP-F': 'Нить полипропиленовая', 'PE-F': 'Нить полиэтиленовая',
  'HMPE-F': 'Волокно HMPE (Dyneema)', 'ARAM-F': 'Нить арамидная (Русар)',
  'SIL-F': 'Волокно кремнеземное', 'BAS-R': 'Ровинг базальтовый',
  'GLS-R': 'Ровинг стеклянный',
  'BOB-K': 'Бобины картонные', 'BOB-P': 'Бобины пластиковые',
  'PKG-STR': 'Стрейч-плёнка', 'PKG-BAG': 'Пакеты ПЭ',
  'STAT-10': 'Верёвка статическая 10мм', 'STAT-11': 'Верёвка статическая 11мм',
  'DYN-105': 'Верёвка динамическая 10.5мм',
  'REP-6': 'Репшнур 6мм', 'REP-7': 'Репшнур 7мм (арамид)',
  'ARAM-6': 'Шнур арамидный 6мм',
  'HMPE-6': 'Канат HMPE 6мм', 'HMPE-10': 'Канат HMPE 10мм',
  'PA-8': 'Канат ПА 8мм', 'PA-10': 'Канат ПА 10мм', 'PA-12': 'Канат ПА 12мм',
  'PP-10': 'Канат ПП 10мм', 'PP-16': 'Канат ПП 16мм', 'PP-24': 'Канат ПП 24мм',
  'SIL-8': 'Шнур кремнеземный 8мм', 'SIL-12': 'Шнур кремнеземный 12мм',
  'BAS-8': 'Шнур базальтовый 8мм', 'BAS-10': 'Шнур базальтовый 10мм',
  'YAHT-8': 'Канат яхтенный 8мм', 'FISH-25': 'Шнур рыболовный 2.5мм',
  'CABLE-6': 'Канат для протяжки 6мм', 'FENCE-8': 'Канат ограждающий 8мм',
  'BAG-4': 'Шнур для пакетов 4мм', 'BANNER-4': 'Шнур баннерный 4мм',
};

export const COMMANDS = {
  'расход':       { label: 'Расход в производство',   type: 'consumption', sign: -1 },
  'отгрузка':     { label: 'Отгрузка клиенту',        type: 'sale',        sign: -1 },
  'приход':       { label: 'Приход от поставщика',    type: 'receipt',     sign: +1 },
  'производство': { label: 'Производство (плетение)', type: 'production',  sign: +1 },
};

export const DAILY_NORM = {
  'PA-F': 150, 'PES-F': 120, 'PP-F': 160, 'PE-F': 60,
  'HMPE-F': 15, 'ARAM-F': 12, 'SIL-F': 20, 'BAS-R': 25,
  'STAT-10': 200, 'DYN-105': 50, 'REP-6': 350,
  'ARAM-6': 140, 'HMPE-6': 200, 'HMPE-10': 80,
  'PA-10': 300, 'PP-16': 200, 'SIL-8': 120, 'BAS-8': 110,
  'YAHT-8': 200, 'CABLE-6': 180, 'FENCE-8': 250,
  'BAG-4': 800, 'BANNER-4': 400,
};

// --- Доступ: PIN сверяется с Env на сервере (Security by default) ---
export function checkPin(pin) {
  const p = String(pin || '').trim();
  const d = String(process.env.DIRECTOR_PIN || '');
  const w = String(process.env.WORKER_PIN || '');
  if (p && d && p === d) return { role: 'director', name: 'Директор' };
  if (p && w && p === w) return { role: 'worker', name: 'Работник' };
  return null;
}

export const isCommand = (text) => String(text || '').trim().startsWith('/');

export function helpText() {
  return '🏭 WMS РЕМЕРА — внутренняя отчётность\n\n' +
    'Команды:\n' +
    '/расход КОЛ-ВО КОД — расход в производство\n' +
    '/отгрузка КОЛ-ВО КОД — отгрузка клиенту\n' +
    '/приход КОЛ-ВО КОД — поступление от поставщика\n' +
    '/производство КОЛ-ВО КОД — произведено ГП\n' +
    '/коды — список кодов\n\n' +
    'Пример: /расход 5 PA-F';
}

export function codesText() {
  const lines = Object.entries(NOMENCLATURE)
    .map(([code, name]) => `• ${code} — ${name}`)
    .join('\n');
  return '📋 Коды номенклатуры:\n\n' + lines;
}

// Слои защиты из v1: формат → словарь команд → словарь кодов → диапазон
// количества → норма ×10 с подтверждением «!».
// Возвращает { text, movement }, где movement = запись для очереди проводок.
export function processCommand(rawText) {
  const text = String(rawText || '').trim();

  if (text === '/start' || text === '/help' || text === '/список') {
    return { text: helpText(), movement: null };
  }
  if (text === '/коды' || text === '/codes') {
    return { text: codesText(), movement: null };
  }

  const match = text.match(/^\/(\S+)\s+(\d+(?:[.,]\d+)?)\s+(\S+?)(?:\s!)?$/i);
  if (!match) {
    return {
      text: '❓ Не понял команду.\n\nФормат:\n/команда КОЛ-ВО КОД\n\nПример:\n/расход 5 PA-F\n\nВсе команды: /список',
      movement: null,
    };
  }

  const cmd = match[1].toLowerCase();
  const qty = parseFloat(match[2].replace(',', '.'));
  const code = match[3].toUpperCase();
  const confirmed = /!$/.test(text);

  if (!COMMANDS[cmd]) {
    return {
      text: `❌ Неизвестная команда „${cmd}".\nДоступно: /расход, /отгрузка, /приход, /производство.\n\nСправка: /список`,
      movement: null,
    };
  }

  const itemName = NOMENCLATURE[code];
  if (!itemName) {
    return { text: `❌ Неизвестный код „${code}".\nСписок кодов: /коды`, movement: null };
  }

  if (qty <= 0 || qty > 1000000) {
    return { text: '❌ Количество должно быть > 0 и ≤ 1 000 000.', movement: null };
  }

  const norm = DAILY_NORM[code];
  if (norm && qty > norm * 10 && !confirmed) {
    return {
      text: `⚠️ ${qty} — это ${Math.round(qty / norm)}× типовой дневной нормы (${norm}).\n\n` +
        `Если это не опечатка — повтори с восклицательным знаком:\n` +
        `/${cmd} ${qty} ${code} !`,
      movement: null,
    };
  }

  const { label, type, sign } = COMMANDS[cmd];
  return {
    text: `✅ Принято: ${label}\n• ${qty} × ${code} (${itemName})\n• Добавлено в очередь проводок — директор подтвердит в WMS`,
    movement: { op: cmd, label, type, sign, code, name: itemName, qty },
  };
}