// lib/store.js — WMS «РЕМЕРА» v2: адаптер Vercel Blob.
// Явная привязка к приватному store: token + storeId + access private
// (официальный контракт, см. Quickstart на странице store).
import { put, get } from '@vercel/blob';

const STATE_KEY = 'wms2/state.json';
const MAX_MESSAGES = 500;

const blobOpts = () => {
  const token = process.env.PRIV_READ_WRITE_TOKEN;
  const storeId = process.env.PRIV_STORE_ID;
  if (!token || !storeId) {
    throw new Error('Не заданы PRIV_READ_WRITE_TOKEN / PRIV_STORE_ID в Env');
  }
  return { access: 'private', token, storeId };
};

export function defaultState() {
  return {
    version: 1,
    stock: {},
    pending: [],
    movements: [],
    messages: [],
  };
}

export async function loadState() {
  try {
    const blob = await get(STATE_KEY, blobOpts());
    if (!blob) return defaultState();
    const text = typeof blob.text === 'function'
      ? await blob.text()
      : typeof blob.arrayBuffer === 'function'
        ? Buffer.from(await blob.arrayBuffer()).toString('utf8')
        : await new Response(blob.body).text();
    return { ...defaultState(), ...JSON.parse(text) };
  } catch (e) {
    const sig = String(e.code || '') + String(e.message || '');
    if (/not.?found|blob_not_found/i.test(sig)) return defaultState();
    console.error('loadState failed:', e.message);
    throw e;
  }
}

export async function saveState(state) {
  try {
    if (Array.isArray(state.messages) && state.messages.length > MAX_MESSAGES) {
      state.messages = state.messages.slice(-MAX_MESSAGES);
    }
    await put(STATE_KEY, JSON.stringify(state), {
      ...blobOpts(),
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  } catch (e) {
    console.error('saveState failed:', e.message);
    throw e;
  }
}

export async function withState(fn) {
  const state = await loadState();
  const result = fn(state);
  await saveState(state);
  return result;
}

export async function storageSelfTest() {
  await put('wms2/debug.txt', 'ok', { ...blobOpts(), addRandomSuffix: false });
  const b = await get('wms2/debug.txt', blobOpts());
  return b ? 'ok' : 'get returned null';
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;