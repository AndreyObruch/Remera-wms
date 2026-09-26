// lib/blob-fs.js — файловое хранилище вместо Vercel Blob (Amvera /data)
import fs from 'fs';
import path from 'path';

const ROOT = (() => {
  for (const dir of ['/data', path.join(process.cwd(), '.data')]) {
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return dir; } catch (e) {}
  }
  return path.join(process.cwd(), '.data');
})();

const fp = (key) => path.join(ROOT, String(key).replace(/\.\./g, ''));

export async function put(key, content) {
  const p = fp(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
  return { url: 'file://' + p, pathname: key, text: async () => fs.readFileSync(p, 'utf8') };
}

export async function get(key) {
  const p = fp(key);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  return { url: 'file://' + p, pathname: key, text: async () => text };
}

export async function del(key) {
  const p = fp(key);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}