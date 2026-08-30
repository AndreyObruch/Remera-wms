// api/max.js — Боевой шлюз MAX (двунаправленный)
// Авторизация: заголовок Authorization. TLS-проверка отключена (Минцифры-CA).
// Отправка с fallback: сначала chat_id, при 400 — user_id (MAX для диалогов
// может требовать user_id; код сам определит рабочий вариант и залоггирует).

const BASE = 'https://platform-api2.max.ru';

const NOMENCLATURE = {
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

const COMMANDS = {
  'расход':       { label: 'Расход в производство',  type: 'consumption' },
  'отгрузка':     { label: 'Отгрузка клиенту',        type: 'sale' },
  'приход':       { label: 'Приход от поставщика',    type: 'receipt' },
  'производство': { label: 'Производство (плетение)', type: 'receipt' },
};

const DAILY_NORM = {
  'PA-F': 150, 'PES-F': 120, 'PP-F': 160, 'PE-F': 60,
  'HMPE-F': 15, 'ARAM-F': 12, 'SIL-F': 20, 'BAS-R': 25,
  'STAT-10': 200, 'DYN-105': 50, 'REP-6': 350,
  'ARAM-6': 140, 'HMPE-6': 200, 'HMPE-10': 80,
  'PA-10': 300, 'PP-16': 200, 'SIL-8': 120, 'BAS-8': 110,
  'YAHT-8': 200, 'CABLE-6': 180, 'FENCE-8': 250,
  'BAG-4': 800, 'BANNER-4': 400,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'MAX_BOT_TOKEN not configured' });

  const update = req.body || {};
  console.log('MAX RAW UPDATE:', JSON.stringify(update));

  if (update.update_type !== 'message_created' || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const msg = update.message;
  const body = msg.body || {};
  const text = (body.text || '').trim();
  const sender = msg.sender || {};
  const username = sender.username || sender.first_name || sender.name || 'без_ника';

  const chatIdWorker = msg.recipient?.chat_id;
  const userIdWorker = sender.user_id;

  if ((!chatIdWorker && !userIdWorker) || !text) {
    return res.status(200).json({ ok: true });
  }

  const reply = processCommand(text, username);

  // Отвечаем работнику (всегда), с fallback chat_id → user_id
  await sendWithFallback(token, chatIdWorker, userIdWorker, reply.text)
    .catch(e => console.error('Worker reply failed:', e.message));

  // Отчёт директору (только если настроен MAX_CHAT_ID в Env)
  if (reply.forwardToDirector) {
    const directorId = process.env.MAX_CHAT_ID;
    if (directorId) {
      await sendWithFallback(token, directorId, directorId, reply.forwardToDirector)
        .catch(e => console.error('Director report failed:', e.message));
    } else {
      console.error(`MAX_CHAT_ID not set. Sender: chat_id=${chatIdWorker}, user_id=${userIdWorker}`);
    }
  }

  res.status(200).json({ ok: true });
}

// Пробует отправить по chat_id; при ошибке — по user_id.
// Успешный вариант логирует, чтобы зафиксировать формат MAX.
async function sendWithFallback(token, chatId, userId, text) {
  if (chatId) {
    try {
      const r = await sendMax(token, { chat_id: chatId }, text);
      console.log(`MAX SEND OK via chat_id=${chatId}`);
      return r;
    } catch (e) {
      console.error(`chat_id=${chatId} failed: ${e.message} — trying user_id`);
    }
  }
  const r = await sendMax(token, { user_id: userId }, text);
  console.log(`MAX SEND OK via user_id=${userId}`);
  return r;
}

function processCommand(text, username) {
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
  const confirmed = Boolean(match[4]);

  if (!COMMANDS[cmd]) {
    return {
      text: `❌ Неизвестная команда „${cmd}".\nДоступно: /расход, /отгрузка, /приход, /производство.\n\nСправка: /список`,
      forwardToDirector: null
    };
  }

  const itemName = NOMENCLATURE[code];
  if (!itemName) {
    return {
      text: `❌ Неизвестный код „${code}".\nСписок кодов: /коды`,
      forwardToDirector: null
    };
  }

  if (qty <= 0 || qty > 1000000) {
    return { text: '❌ Количество должно быть > 0 и ≤ 1 000 000.', forwardToDirector: null };
  }

  const norm = DAILY_NORM[code];
  if (norm && qty > norm * 10 && !confirmed) {
    return {
      text: `⚠️ ${qty} — это ${Math.round(qty / norm)}× типовой дневной нормы (${norm}).\n\n` +
        `Если это не опечатка — повтори с восклицательным знаком:\n` +
        `/${cmd} ${qty} ${code} !`,
      forwardToDirector: null
    };
  }

  const { label } = COMMANDS[cmd];
  return {
    text: `✅ Принято: ${label}\n• ${qty} × ${code} (${itemName})\n• Отправлено в журнал`,
    forwardToDirector: `📝 *Отчёт с производства*\n\n` +
      `*От:* @${username}\n*Операция:* ${label}\n*Код:* ${code}\n` +
      `*Наименование:* ${itemName}\n*Количество:* ${qty}\n` +
      `_Для проводки в WMS: открыть вкладку „Движения" → „Провести"_`
  };
}

async function sendMax(token, recipient, text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...recipient, text }),
      signal: controller.signal
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MAX API ${response.status}: ${errText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}