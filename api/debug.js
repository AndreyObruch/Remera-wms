// api/debug.js — debug-5: подбор wire-формата private access.
const API = 'https://blob.vercel-storage.com';

export default async function handler(req, res) {
  const token = process.env.PRIV_READ_WRITE_TOKEN;
  const storeId = process.env.PRIV_STORE_ID;
  const results = {};

  const tryPut = async (name, url, headers) => {
    try {
      const r = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'x-api-version': '7', 'Content-Type': 'text/plain', ...headers },
        body: 'ok',
      });
      const t = await r.text();
      results[name] = r.ok ? 'OK ' + t.slice(0, 60) : `${r.status}: ${t.slice(0, 90)}`;
    } catch (e) {
      results[name] = 'ERR: ' + String(e.message || e).slice(0, 90);
    }
  };

  if (token) {
    await tryPut('V1_query_access', `${API}/wms2/v1.txt?access=private`, {});
    await tryPut('V2_header_xaccess', `${API}/wms2/v2.txt`, { 'x-access': 'private' });
    await tryPut('V5_query_plus_storeid', `${API}/wms2/v5.txt?access=private`, { 'x-store-id': storeId || '' });
    if (storeId) {
      const host = `https://${storeId}.private.blob.vercel-storage.com`;
      await tryPut('V3_store_host', `${host}/wms2/v3.txt`, {});
      await tryPut('V4_store_host_query', `${host}/wms2/v4.txt?access=private`, {});
    }
    const g = await fetch(`${API}/wms2/v1.txt`, { headers: { Authorization: `Bearer ${token}`, 'x-api-version': '7' } });
    results.read_after_V1 = String(g.status);
  }
  res.status(200).json({ build: 'debug-5', results });
}