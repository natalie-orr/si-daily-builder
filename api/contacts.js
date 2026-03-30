const crypto = require('crypto');

const SHEET_ID     = '12iRhnjYCYeLHc7onX7HRdwjeDpNjIFjDWoJgRgSiu64';
const CONTACTS_GID = '812606877';

function makeJWT(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${sign.sign(creds.private_key, 'base64url')}`;
}

async function getToken(creds) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${makeJWT(creds)}`,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error_description || 'Could not get access token — check service account credentials');
  return d.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT environment variable is not set in Vercel.' });
    }

    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const token = await getToken(creds);

    // Find sheet name from GID
    const meta = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    const match = (meta.sheets || []).find(s => String(s.properties.sheetId) === String(CONTACTS_GID));
    const range = encodeURIComponent(match ? `'${match.properties.title}'!A:F` : 'A:F');

    // Fetch rows
    const data = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    const values = data.values || [];
    if (values.length < 2) return res.json({ rows: [] });

    const headers = values[0].map(h => String(h || '').trim());
    const rows = values.slice(1)
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i] != null ? String(row[i]) : ''; });
        return obj;
      })
      .filter(r => r.n);

    return res.json({ rows });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
