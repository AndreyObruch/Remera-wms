// lib/store.js — v11: allowOverwrite для нового SDK (перезапись state.json)
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
  return { version: 1, stock: {}, pending: [], movements: [], messages: [] };
}

async function blobToText(blob) {
  if (typeof blob.text === 'function') return await blob.text();
  if (typeof blob.arrayBuffer === 'function') {
    return Buffer.from(await blob.arrayBuffer()).toString('utf8');
  }
  if (blob.body) return await new Response(blob.body).text();
  if (typeof blob === 'string') return blob;
  return '';
}

export async function loadState() {
  let blob;
  try {
    blob = await get(STATE_KEY, blobOpts());
  } catch (e) {
    const sig = String(e.code || '') + String(e.message || '');
    if (/not.?found|blob_not_found/i.test(sig)) return defaultState();
    throw e;
  }
  if (!blob) return defaultState();

  const text = await blobToText(blob);
  if (!text || !text.trim()) return defaultState();

  try {
    return { ...defaultState(), ...JSON.parse(text) };
  } catch (e) {
    return defaultState();
  }
}

export async function saveState(state) {
  if (Array.isArray(state.messages) && state.messages.length > MAX_MESSAGES) {
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }
  await put(STATE_KEY, JSON.stringify(state), {
    ...blobOpts(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function withState(fn) {
  const state = await loadState();
  const result = fn(state);
  await saveState(state);
  return result;
}

export async function storageSelfTest() {
  await put('wms2/debug.txt', 'ok', {
    ...blobOpts(),
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  const b = await get('wms2/debug.txt', blobOpts());
  return b ? 'ok' : 'get returned null';
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;