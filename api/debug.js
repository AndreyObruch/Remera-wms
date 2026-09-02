// api/debug.js — debug-6: диагностика SDK с явным PRIV-токеном
import { storageSelfTest } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    // Проверка наличия старых публичных токенов (они больше не нужны)
    const hasOldBlobToken = !!(
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.BLOB_WEBHOOK_PUBLIC_KEY
    );

    // Тест приватного store через SDK
    let blob = 'error';
    try {
      blob = await storageSelfTest();
    } catch (e) {
      blob = `error: ${e.message || String(e)}`;
    }

    res.status(200).json({
      build: 'debug-6',
      hasOldBlobToken,
      blob,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      build: 'debug-6',
      fatal: e.message || String(e),
      ts: new Date().toISOString(),
    });
  }
}