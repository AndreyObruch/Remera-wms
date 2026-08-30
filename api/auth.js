// api/auth.js — WMS «РЕМЕРА» v2: вход по PIN.
// PIN сверяется на сервере с Env (Security by default).
import { checkPin } from '../lib/core.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { pin } = req.body || {};
    const user = checkPin(pin);
    if (!user) {
      return res.status(401).json({ error: 'Неверный PIN' });
    }
    return res.status(200).json({ ok: true, role: user.role, name: user.name });
  } catch (e) {
    console.error('auth error:', e.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}