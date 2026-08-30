// lib/store.js — WMS «РЕМЕРА» v2: адаптер хранилища на Vercel Blob (private).
import { put, get } from '@vercel/blob';

const STATE_KEY = 'wms2/state.json';
const MAX_MESSAGES = 500;

export function defaultState() {
  return {
    version: 1,
    stock: {},      // { CODE: количество } — серверные остатки
    pending: [],    // очередь движений, ждёт подтверждения директора
    movements: [],  // проведённые движения
    messages: [],   // внутренний чат
  };
}

export async function loadState() {
  try {
    const blob = await get(STATE_KEY);
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
      access: 'private',
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

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;