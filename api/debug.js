// api/debug.js — ВРЕМЕННАЯ самодиагностика (удалим после наладки).
import { put, get } from '@vercel/blob';

export default async function handler(req, res) {
  const out = {
    build: 'debug-1',
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasWorkerPin: Boolean(process.env.WORKER_PIN),
    hasDirectorPin: Boolean(process.env.DIRECTOR_PIN),
    blob: null,
  };
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    await put('wms2/debug.txt', 'ok', { access: 'private', addRandomSuffix: false, token });
    const b = await get('wms2/debug.txt', { token });
    out.blob = b ? 'ok' : 'get returned null';
  } catch (e) {
    out.blob = 'ERROR: ' + (e.message || String(e));
  }
  res.status(200).json(out);
}