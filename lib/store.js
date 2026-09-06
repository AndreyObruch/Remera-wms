// lib/store.js — v14: защита от затирания состояния при сбое чтения
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

async function tryText(fn) {
  try {
    const t = await fn();
    if (typeof t === 'string' && t.length > 0) return t;
  } catch (e) { /* пробуем следующий способ */ }
  return '';
}

async function blobToText(blob) {
  if (!blob) return '';
  if (typeof blob === 'string') return blob;

  let text = '';
  if (blob.blob && typeof blob.blob.text === 'function')
    text = await tryText(() => blob.blob.text());
  if (!text && blob.stream)
    text = await tryText(() => new Response(blob.stream).text());
  if (!text && typeof blob.text === 'function')
    text = await tryText(() => blob.text());
  if (!text && typeof blob.arrayBuffer === 'function')
    text = await tryText(async () => Buffer.from(await blob.arrayBuffer()).toString('utf8'));
  if (!text && blob.body)
    text = await tryText(() => new Response(blob.body).text());
  if (!text && blob.url)
    text = await tryText(async () => {
      const r = await fetch(blob.url);
      return r.ok ? await r.text() : '';
    });

  if (!text) console.error('[store] blobToText пусто; keys =', Object.keys(blob).join(','));
  return text;
}

// Внутреннее чтение: safe=false = «blob существует, но не читается» → запись ЗАПРЕЩЕНА
async function loadStateRaw() {
  let blob;
  try {
    blob = await get(STATE_KEY, blobOpts());
  } catch (e) {
    const sig = String(e.code || '') + String(e.message || '');
    if (/not.?found|blob_not_found/i.test(sig)) return { state: defaultState(), safe: true };
    throw e;
  }
  if (!blob) return { state: defaultState(), safe: true };

  const text = await blobToText(blob);
  if (!text || !text.trim()) return { state: defaultState(), safe: false };

  try {
    return { state: { ...defaultState(), ...JSON.parse(text) }, safe: true };
  } catch (e) {
    return { state: defaultState(), safe: false };
  }
}

export async function loadState() {
  return (await loadStateRaw()).state;
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
  const { state, safe } = await loadStateRaw();
  if (!safe) throw new Error('Состояние не читается — запись заблокирована (защита от затирания)');
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
  const t = await blobToText(b);
  return t === 'ok' ? 'ok' : `read-back: "${t}"`;
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;