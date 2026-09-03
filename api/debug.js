// api/debug.js — debug-7: детальная диагностика SDK (версия + матрица put/get)
import { put, get } from '@vercel/blob';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const opts = (extra = {}) => ({
  token: process.env.PRIV_READ_WRITE_TOKEN,
  storeId: process.env.PRIV_STORE_ID,
  addRandomSuffix: false,
  ...extra,
});

const err = (e) => `${e.code ? e.code + ': ' : ''}${e.message || String(e)}`;

export default async function handler(req, res) {
  let sdkVersion = 'unknown';
  try {
    sdkVersion = require('@vercel/blob/package.json').version;
  } catch (e) {
    sdkVersion = 'read-error: ' + err(e);
  }

  const out = {
    build: 'debug-7',
    sdkVersion,
    hasOldBlobToken: !!(
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.BLOB_WEBHOOK_PUBLIC_KEY
    ),
  };

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