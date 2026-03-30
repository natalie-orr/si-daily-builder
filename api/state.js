const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV_NOT_CONFIGURED');
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`KV HTTP ${r.status}`);
  const json = await r.json();
  return json.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const today = new Date().toISOString().slice(0, 10);
  const key   = `state:${today}`;

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', key]);
      const state = raw ? JSON.parse(raw) : { cards: {}, subs: {}, note: '' };
      return res.json(state);
    }

    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      await redis(['SET', key, JSON.stringify(data), 'EX', '172800']);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    if (err.message === 'KV_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'KV env vars missing — check Vercel Storage is connected and redeploy.' });
    }
    return res.status(500).json({ error: err.message });
  }
};
