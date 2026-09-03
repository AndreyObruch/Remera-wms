// api/debug.js — debug-10: проверка lib/core.js (импорт + вызов)
import { isCommand, processCommand } from '../lib/core.js';

export default async function handler(req, res) {
  const out = { build: 'debug-10' };

  // Тест 1: isCommand
  try {
    out.isCommand_test = isCommand('/расход 5 PA-F') ? 'ok' : 'unexpected-false';
  } catch (e) {
    out.isCommand_error = e.message || String(e);
  }

  // Тест 2: processCommand
  try {
    const r = processCommand('/расход 5 PA-F');
    out.processCommand = {
      text: r.text ? r.text.slice(0, 100) : null,
      movement: r.movement ? 'present' : 'null',
    };
  } catch (e) {
    out.processCommand_error = e.message || String(e);
  }

  // Тест 3: import самого модуля (если падает здесь, оба теста выше не сработают)
  try {
    const core = await import('../lib/core.js');
    out.coreImport = 'ok';
    out.coreExports = Object.keys(core).slice(0, 10);
  } catch (e) {
    out.coreImport_error = e.message || String(e);
  }

  res.status(200).json({ ...out, ts: new Date().toISOString() });
}