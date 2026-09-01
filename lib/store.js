// api/debug.js — debug-4: REST-контракт без SDK.
import { storageSelfTest } from '../lib/store.js';

export default async function handler(req, res) {
  const out = {
    build: 'debug-4',
    hasToken: Boolean(process.env.PRIV_READ_WRITE_TOKEN),
    blob: null,
  };
  try {
    out.blob = await storageSelfTest();
  } catch (e) {
    out.blob = 'ERROR: ' + String(e.message || e).slice(0, 200);
  }
  res.status(200).json(out);
}