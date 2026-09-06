// api/debug.js — debug-11: форма результата get() и поиск рабочего канала чтения
import { get } from '@vercel/blob';

const opts = () => ({
  access: 'private',
  token: process.env.PRIV_READ_WRITE_TOKEN,
  storeId: process.env.PRIV_STORE_ID,
});

export default async function handler(req, res) {
  const out = { build: 'debug-11' };
  try {
    const b = await get('wms2/state.json', opts());
    out.exists = !!b;
    out.keys = b ? Object.keys(b) : null;
    out.types = b
      ? {
          text: typeof b.text,
          arrayBuffer: typeof b.arrayBuffer,
          stream: typeof b.stream,
          body: typeof b.body,
          url: typeof b.url,
          downloadUrl: typeof b.downloadUrl,
        }
      : null;
    out.size = b && b.size;

    if (b && typeof b.text === 'function') {
      try {
        const t = await b.text();
        out.textLen = t.length;
        out.head = t.slice(0, 80);
      } catch (e) { out.textErr = e.message; }
    }

    if (b && b.url) {
      try {
        const r = await fetch(b.url);
        out.urlStatus = r.status;
        const t = await r.text();
        out.urlLen = t.length;
        out.urlHead = t.slice(0, 80);
      } catch (e) { out.urlErr = e.message; }
    }

    if (b && b.downloadUrl) {
      try {
        const r = await fetch(b.downloadUrl);
        out.dlStatus = r.status;
        const t = await r.text();
        out.dlLen = t.length;
        out.dlHead = t.slice(0, 80);
      } catch (e) { out.dlErr = e.message; }
    }
  } catch (e) {
    out.getError = e.message;
  }
  res.status(200).json({ ...out, ts: new Date().toISOString() });
}