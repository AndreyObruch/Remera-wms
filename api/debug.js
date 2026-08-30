// api/debug.js — ВРЕМЕННАЯ самодиагностика (удалим после наладки).
import { storageSelfTest } from '../lib/store.js';

export default async function handler(req, res) {
  const out = {
    build: 'debug-2',
    hasPrivToken: Boolean(process.env.PRIV_READ_WRITE_TOKEN),
    hasWorkerPin: Boolean(process.env.WORKER_PIN),
    hasDirectorPin: Boolean(process.env.DIRECTOR_PIN),
    blob: null,
  };
  try {
    out.blob = await storageSelfTest();
  } catch (e) {
    out.blob = 'ERROR: ' + (e.message || String(e));
  }
  res.status(200).json(out);
}