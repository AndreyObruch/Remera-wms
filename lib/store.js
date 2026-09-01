// lib/store.js — v7: прямой REST к Vercel Blob, БЕЗ SDK.
const API = 'https://blob.vercel-storage.com';
const STATE_KEY = 'wms2/state.json';
const MAX_MESSAGES = 500;

const token = () => {
  const t = process.env.PRIV_READ_WRITE_TOKEN;
  if (!t) throw new Error('PRIV_READ_WRITE_TOKEN не задан в Env');
  return t;
};

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${token()}`,
  'x-api-version': '7',
  ...extra,
});

async function blobPut(pathname, text, contentType = 'application/json') {
  const r = await fetch(`${API}/${pathname}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': contentType }),
    body: text,
  });
  if (!r.ok) throw new Error(`Blob PUT ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function blobGetText(pathname) {
  const r = await fetch(`${API}/${pathname}`, { headers: authHeaders() });
  if (r.status === 404) return null;
  if (r.ok) return await r.text();
  const l = await fetch(`${API}/?prefix=${encodeURIComponent(pathname)}`, { headers: authHeaders() });
  if (!l.ok) throw new Error(`Blob GET ${r.status}, list ${l.status}`);
  const data = await l.json();
  const item = (data.blobs || []).find((b) => b.pathname === pathname);
  if (!item || !item.downloadUrl) return null;
  const d = await fetch(item.downloadUrl);
  if (!d.ok) throw new Error('Blob download failed: ' + d.status);
  return await d.text();
}

export function defaultState() {
  return { version: 1, stock: {}, pending: [], movements: [], messages: [] };
}

export async function loadState() {
  try {
    const text = await blobGetText(STATE_KEY);
    if (!text) return defaultState();
    return { ...defaultState(), ...JSON.parse(text) };
  } catch (e) {
    if (/not.?found/i.test(String(e.message || ''))) return defaultState();
    console.error('loadState failed:', e.message);
    throw e;
  }
}

export async function saveState(state) {
  if (Array.isArray(state.messages) && state.messages.length > MAX_MESSAGES) {
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }
  await blobPut(STATE_KEY, JSON.stringify(state));
}

export async function withState(fn) {
  const state = await loadState();
  const result = fn(state);
  await saveState(state);
  return result;
}

export async function storageSelfTest() {
  await blobPut('wms2/debug.txt', 'ok', 'text/plain');
  const t = await blobGetText('wms2/debug.txt');
  return t === 'ok' ? 'ok' : 'read mismatch: ' + String(t).slice(0, 80);
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;