// api/telegram.js
// Серверная функция Vercel (Serverless) для отправки алертов в Telegram.
// Изолирует логику отправки от клиентского браузера, скрывая токен бота.

export default async function handler(req, res) {
  // Разрешаем только POST-запросы для защиты от случайных обращений
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  // Чтение секретов из переменных окружения Vercel (Environment Variables)
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Fallback: если админ забыл настроить переменные, возвращаем ошибку, но не роняем клиент
  if (!token || !chatId) {
    console.error('Telegram credentials missing in Vercel Env Vars');
    return res.status(500).json({ error: 'Telegram not configured' });
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Отправка запроса к Telegram API
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: ` *WMS РЕМЕРА: Критический дефицит*\n\n${message}`,
        parse_mode: 'Markdown' // Включаем жирный шрифт для заголовка
      })
    });

    if (!response.ok) throw new Error(`Telegram API responded with ${response.status}`);
    
    res.status(200).json({ success: true });
  } catch (error) {
    // Ловим сетевые сбои API Telegram, чтобы интерфейс склада продолжал работать
    console.error('Telegram send failed:', error.message);
    res.status(500).json({ error: 'Failed to send alert' });
  }
}