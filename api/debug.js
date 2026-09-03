// api/debug.js — debug-8: крашеустойчивый зонд (всё внутри try-catch)
import { put, get } from '@vercel/blob';

const opts = (extra = {}) => ({
  token: process.env.PRIV_READ_WRITE_TOKEN,
  storeId: process.env.PRIV_STORE_ID,
  addRandomSuffix: false,
  ...extra,
});

const err = (e) =>
  `${e && e.code ? e.code + ': ' : ''}${(e && e.message) || String(e)}`;

export default async function handler(req, res) {
  const out = { build: 'debug-8' };

  // Версия SDK — только внутри защищённого блока
  try {
    const mod = await import('module');
    const reqLocal = mod.createRequire(process.cwd() + '/');
    out.sdkVersion = reqLocal('@vercel/blob/package.json').version;
  } catch (e) {
    out.sdkVersion = 'probe-error';
  }

  // Тест A: put БЕЗ опции access
  try {
    await put('wms2/tA.txt', 'ok', opts());
    out.putPlain = 'ok';
  } catch (e) {
    out.putPlain = err(e);
  }

  // Тест B: put С access:'private'
  try {
    await put('wms2/tB.txt', 'ok', opts({ access: 'private' }));
    out.putPrivate = 'ok';
  } catch (e) {
    out.putPrivate = err(e);
  }

  // get: читаем то, что могло записаться
  try {
    const b = await get('wms2/tA.txt', opts());
    out.get = b ? 'ok' : 'null';
  } catch (e) {
    out.get = err(e);
  }

  res.status(200).json({ ...out, ts: new Date().toISOString() });
}