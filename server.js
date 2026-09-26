// server.js — единый Express-сервер вместо Vercel serverless (Amvera)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import analyticsHandler from './api/analytics.js';
import approveHandler   from './api/approve.js';
import authHandler      from './api/auth.js';
import chatHandler      from './api/chat.js';
import exportHandler    from './api/export.js';
import importHandler    from './api/import.js';
import stockHandler     from './api/stock.js';
import { storageSelfTest } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');

// парсеры: JSON + текст (CSV-импорт) + формы
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: ['text/plain', 'text/csv'], limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// маппинг serverless-хендлеров (проверку метода оставляем внутри хендлера)
const routes = {
  '/api/analytics': analyticsHandler,
  '/api/approve':   approveHandler,
  '/api/auth':      authHandler,
  '/api/chat':      chatHandler,
  '/api/export':    exportHandler,
  '/api/import':    importHandler,
  '/api/stock':     stockHandler,
};
for (const [route, handler] of Object.entries(routes)) {
  app.all(route, async (req, res) => {
    try { await handler(req, res); }
    catch (e) {
      console.error('[api]', route, e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });
}

// health + самотест хранилища для проверки деплоя
app.get('/api/health', async (_req, res) => {
  let store = 'skip';
  try { store = await storageSelfTest(); } catch (e) { store = 'ERR: ' + e.message; }
  res.json({ ok: true, service: 'remera-wms', store, time: new Date().toISOString() });
});

// статика: закрытые серверные пути не отдаём
app.use((req, res, next) => {
  if (/^\/(lib|node_modules|\.git|\.env|vercel\.json|make_.*\.py)/i.test(req.path))
    return res.sendStatus(404);
  next();
});
app.use(express.static(__dirname, { index: 'index.html' }));

// SPA-фолбэк: неизвестный GET -> index.html (кроме /api)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api'))
    return res.sendFile(path.join(__dirname, 'index.html'));
  next();
});

const PORT = Number(process.env.PORT) || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`[remera-wms] listening :${PORT}`));