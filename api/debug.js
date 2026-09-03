// api/debug.js — debug-9: end-to-end проверка store.js v8
import { storageSelfTest, loadState } from '../lib/store.js';

export default async function handler(req, res) {
  const out = { build: 'debug-9' };

  // put + get через боевой blobOpts() (access:'private' + PRIV-токены)
  try {
    out.selfTest = await storageSelfTest();
  } catch (e) {
    out.selfTest = `error: ${e.message || String(e)}`;
  }

  // чтение состояния так, как это делает чат
  try {
    const st = await loadState();
    out.loadState = `ok (messages: ${Array.isArray(st.messages) ? st.messages.length : 0})`;
  } catch (e) {
    out.loadState = `error: ${e.message || String(e)}`;
  }

  res.status(200).json({ ...out, ts: new Date().toISOString() });
}