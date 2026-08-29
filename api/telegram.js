// api/telegram.js
// Двунаправленный шлюз Telegram: отправка алертов + приём команд от работников
// Один endpoint, роутинг по структуре тела POST-запроса:
//   - {message: "..."}           → отправка алерта от WMS
//   - {message: {text: "/..."}}  → входящая команда от работника (webhook от Telegram)

// ============================================================
// СПРАВОЧНИК НОМЕНКЛАТУРЫ (коды, которые бот принимает)
// Должен совпадать с items.article_id в db.js
// Обновляется при расширении номенклатуры
// ============================================================
const NOMENCLATURE = {
  // Сырьё
  'PA-F': 'Нить полиамидная (капрон)',
  'PES-F': 'Нить полиэфирная',
  'PP-F': 'Нить полипропиленовая',
  'PE-F': 'Нить полиэтиленовая',
  'HMPE-F': 'Волокно HMPE (Dyneema)',
  'ARAM-F': 'Нить арамидная (Русар)',
  'SIL-F': 'Волокно кремнеземное',
  'BAS-R': 'Ровинг базальтовый',
  'GLS-R': 'Ровинг стеклянный',
  // Расходники
  'BOB-K': 'Бобины картонные', 'BOB-P': 'Бобины пластиковые',
  'PKG-STR': 'Стрейч-плёнка', 'PKG-BAG': 'Пакеты ПЭ',
  // ГП — Промальп
  'STAT-10': 'Верёвка статическая 10мм',
  'STAT-11': 'Верёвка статическая 11мм',
  'DYN-105': 'Верёвка динамическая 10.5мм',
  'REP-6': 'Репшнур 6мм', 'REP-7': 'Репшнур 7мм (арамид)',
  // ГП — Арамид/HMPE
  'ARAM-6': 'Шнур арамидный 6мм',
  'HMPE-6': 'Канат HMPE 6мм', 'HMPE-10': 'Канат HMPE 10мм',
  // ГП — Полиамид
  'PA-8': 'Канат ПА 8мм', 'PA-10': 'Канат ПА 10мм', 'PA-12': 'Канат ПА 12мм',
  // ГП — Полипропилен
  'PP-10': 'Канат ПП 10мм', 'PP-16': 'Канат ПП 16мм', 'PP-24': 'Канат ПП 24мм',
  // ГП — Огнеупорные
  'SIL-8': 'Шнур кремнеземный 8мм', 'SIL-12': 'Шнур кремнеземный 12мм',
  'BAS-8': 'Шнур базальтовый 8мм', 'BAS-10': 'Шнур базальтовый 10мм',
  // ГП — Яхты/рыболовные
  'YAHT-8': 'Канат яхтенный 8мм', 'FISH-25': 'Шнур рыболовный 2.5мм',
  // ГП — Протяжка/ограждение
  'CABLE-6': 'Канат для протяжки 6мм', 'FENCE-8': 'Канат ограждающий 8мм',
  // ГП — Упаковка/баннер
  'BAG-4': 'Шнур для пакетов 4мм', 'BANNER-4': 'Шнур баннерный 4мм',
};

// Команды и их метки в отчёте директору
const COMMANDS = {
  'расход':       { label: 'Расход в производство',  type: 'consumption' },
  'отгрузка':     { label: 'Отгрузка клиенту',        type: 'sale' },
  'приход':       { label: 'Приход от поставщика',    type: 'receipt' },
  'производство': { label: 'Производство (плетение)', type: 'receipt' },
};

// Типовая суточная норма (грубый фильтр опечаток: 10× от нормы = аномалия)
const DAILY_NORM = {
  'PA-F': 150, 'PES-F': 120, 'PP-F': 160, 'PE-F': 60,
  'HMPE-F': 15, 'ARAM-F': 12, 'SIL-F': 20, 'BAS-R': 25,
  'STAT-10': 200, 'DYN-105': 50, 'REP-6': 350,
  'ARAM-6': 140, 'HMPE-6': 200, 'HMPE-10': 80,
  'PA-10': 300, 'PP-16': 200, 'SIL-8': 120, 'BAS-8': 110,
  'YAHT-8': 200, 'CABLE-6': 180, 'FENCE-8': 250,
  'BAG-4': 800, 'BANNER-4': 400,
};

// ============================================================
// ГЛАВНЫЙ HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram credentials missing');
    return res.status(500).json({ error: 'Telegram not configured' });
  }

  // === ВЕТОЧКА 1: ВХОДЯЩЕЕ СООБЩЕНИЕ ОТ РАБОТНИКА (webhook) ===
  if (req.body.message && req.body.message.text) {
    // Защита: проверяем секрет webhook (Telegram шлёт его в заголовке)
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const incoming = req.headers['x-telegram-bot-api-secret-token'];
      if (incoming !== secret) {
        return res.status(401).json({ error: 'Bad webhook signature' });
      }
    }

    const from = req.body.message.from || {};
    const username = from.username || from.first_name || 'без_ника';
    const chatIdWorker = String(req.body.message.chat.id);
    const text = req.body.message.text.trim();

    const reply = processCommand(text, username);

    // Отвечаем работнику
    await sendTelegram(token, chatIdWorker, reply.text);

    // Параллельно: форвард в чат директора (если операция прошла валидацию)
    if (reply.forwardToDirector) {
      await sendTelegram(token, chatId, reply.forwardToDirector);
    }

    return res.status(200).json({ ok: true });
  }

  // === ВЕТОЧКА 2: ОТПРАВКА АЛЕРТА ОТ WMS (старая логика) ===
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    await sendTelegram(token, chatId, `*WMS РЕМЕРА: Критический дефицит*\n\n${message}`, 'Markdown');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Telegram send failed:', error.message);
    res.status(500).json({ error: 'Failed to send alert' });
  }
}

// ============================================================
// ОБРАБОТКА КОМАНДЫ (4 СЛОЯ ЗАЩИТЫ)
// ============================================================
function processCommand(text, username) {
  // Слой 0: справочные команды
  if (text === '/start' || text === '/help' || text === '/список') {
    return {
      text: '🏭 WMS РЕМЕРА — полевая отчётность\n\n' +
        'Команды:\n' +
        '/расход КОЛ-ВО КОД — расход в производство\n' +
        '/отгрузка КОЛ-ВО КОД — отгрузка клиенту\n' +
        '/приход КОЛ-ВО КОД — поступление от поставщика\n' +
        '/производство КОЛ-ВО КОД — произведено ГП\n' +
        '/коды — список кодов\n\n' +
        'Пример: /расход 5 PA-F',
      forwardToDirector: null
    };
  }

  if (text === '/коды' || text === '/codes') {
    const lines = Object.entries(NOMENCLATURE)
      .slice(0, 20)
      .map(([code, name]) => `• ${code} — ${name}`)
      .join('\n');
    return {
      text: '📋 Коды номенклатуры (первые 20):\n\n' + lines + '\n\nПолный список — на вкладке „Склад" WMS.',
      forwardToDirector: null
    };
  }

  // Парсим: /команда количество КОД [!]
  const match = text.match(/^\/(\S+)\s+(\d+(?:[.,]\d+)?)\s+(\S+?)(\s!)?$/i);
  if (!match) {
    return {
      text: '❓ Не понял команду.\n\nФормат:\n/команда КОЛ-ВО КОД\n\nПример:\n/расход 5 PA-F\n\nВсе команды: /список',
      forwardToDirector: null
    };
  }

  const cmd = match[1].toLowerCase();
  const qty = parseFloat(match[2].replace(',', '.'));
  const code = match[3].toUpperCase();
  const confirmed = Boolean(match[4]); // восклицательный знак в конце

  // Слой 1: валидация команды
  if (!COMMANDS[cmd]) {
    return {
      text: `❌ Неизвестная команда „${cmd}".\nДоступно: /расход, /отгрузка, /приход, /производство.\n\nСправка: /список`,
      forwardToDirector: null
    };
  }

  // Слой 2: валидация кода в справочнике
  const itemName = NOMENCLATURE[code];
  if (!itemName) {
    return {
      text: `❌ Неизвестный код „${code}".\nСписок кодов: /коды`,
      forwardToDirector: null
    };
  }

  // Валидация количества
  if (qty <= 0 || qty > 1000000) {
    return {
      text: '❌ Количество должно быть > 0 и ≤ 1 000 000.',
      forwardToDirector: null
    };
  }

  // Слой 3: здравый смысл (аномалия > 10× нормы)
  const norm = DAILY_NORM[code];
  if (norm && qty > norm * 10 && !confirmed) {
    return {
      text: `⚠️ ${qty} — это ${Math.round(qty / norm)}× типовой дневной нормы (${norm}).\n\n` +
        `Если это не опечатка — повтори с восклицательным знаком:\n` +
        `/${cmd} ${qty} ${code} !`,
      forwardToDirector: null
    };
  }

  // Слой 4: операция валидирована, отвечаем работнику и пересылаем директору
  const { label } = COMMANDS[cmd];
  const workerReply = `✅ Принято: ${label}\n` +
    `• ${qty} × ${code} (${itemName})\n` +
    `• Отправлено в журнал`;

  const directorReport = `📝 *Отчёт с производства*\n\n` +
    `*От:* @${username}\n` +
    `*Операция:* ${label}\n` +
    `*Код:* ${code}\n` +
    `*Наименование:* ${itemName}\n` +
    `*Количество:* ${qty}\n` +
    `_Для проводки в WMS: открыть вкладку „Движения" → „Провести"_`;

  return {
    text: workerReply,
    forwardToDirector: directorReport
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ: отправка одного сообщения в Telegram
// ============================================================
async function sendTelegram(token, chatId, text, parseMode = null) {
  const body = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram API ${response.status}: ${errText}`);
  }
  return response.json();
}