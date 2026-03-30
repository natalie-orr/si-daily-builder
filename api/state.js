const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  return r.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV store not connected — go to Vercel Storage and connect it to this project.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const key   = `state:${today}`;

  try {
    if (req.method === 'GET') {
      const { result } = await redis(['GET', key]);
      return res.json(result ? JSON.parse(result) : { cards: {}, subs: {}, note: '' });
    }

    if (req.method === 'POST') {
      let raw = '';
      await new Promise(function(resolve, reject) {
        req.on('data', function(chunk) { raw += chunk; });
        req.on('end', resolve);
        req.on('error', reject);
      });
      const data = JSON.parse(raw);
      await redis(['SET', key, JSON.stringify(data), 'EX', '172800']);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
