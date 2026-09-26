// lib/store.js — v17: файловое хранилище, защита от затирания сохранена
import { put, get } from './blob-fs.js';

const STATE_KEY = 'wms2/state.json';
const MAX_MESSAGES = 500;

export function defaultState() {
  return { version: 1, stock: {}, pending: [], movements: [], messages: [] };
}

async function loadStateRaw() {
  let blob;
  try { blob = await get(STATE_KEY); }
  catch (e) { return { state: defaultState(), safe: true }; }
  if (!blob) return { state: defaultState(), safe: true };
  let text = '';
  try { text = await blob.text(); } catch (e) { text = ''; }
  if (!text || !text.trim()) return { state: defaultState(), safe: false };
  try { return { state: { ...defaultState(), ...JSON.parse(text) }, safe: true }; }
  catch (e) { return { state: defaultState(), safe: false }; }
}

export async function loadState() { return (await loadStateRaw()).state; }

export async function saveState(state) {
  if (Array.isArray(state.messages) && state.messages.length > MAX_MESSAGES)
    state.messages = state.messages.slice(-MAX_MESSAGES);
  await put(STATE_KEY, JSON.stringify(state));
}

export async function withState(fn) {
  const { state, safe } = await loadStateRaw();
  if (!safe) throw new Error('Состояние не читается — запись заблокирована (защита от затирания)');
  const result = fn(state);
  await saveState(state);
  return result;
}

export async function storageSelfTest() {
  await put('wms2/debug.txt', 'ok');
  const b = await get('wms2/debug.txt');
  const t = b ? await b.text() : '';
  return t === 'ok' ? 'ok' : `read-back: "${t}"`;
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;