const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const today = new Date().toISOString().slice(0, 10);
  const key   = `state:${today}`;

  try {
    if (req.method === 'GET') {
      const state = await kv.get(key);
      return res.json(state || { cards: {}, subs: {}, note: '' });
    }

    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const data = JSON.parse(raw);
      await kv.set(key, data, { ex: 172800 });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
