// api/debug.js — debug-3: матрица вариантов вызова Blob.
import { put } from '@vercel/blob';

export default async function handler(req, res) {
  const token = process.env.PRIV_READ_WRITE_TOKEN;
  const storeId = process.env.PRIV_STORE_ID;
  const results = {};
  const combos = {
    A_private_token_storeId: { access: 'private', token, storeId },
    B_token_storeId: { token, storeId },
    C_private_token: { access: 'private', token },
    D_token: { token },
    F_public_token_storeId: { access: 'public', token, storeId },
  };
  for (const [name, opts] of Object.entries(combos)) {
    try {
      await put(`wms2/t-${name}.txt`, 'ok', { ...opts, addRandomSuffix: false });
      results[name] = 'ok';
    } catch (e) {
      results[name] = 'ERR: ' + String(e.message || e).slice(0, 120);
    }
  }
  res.status(200).json({
    build: 'debug-3',
    hasToken: Boolean(token),
    hasStoreId: Boolean(storeId),
    results,
  });
}