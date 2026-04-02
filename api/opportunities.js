const crypto = require('crypto');

const SHEET_ID       = '12iRhnjYCYeLHc7onX7HRdwjeDpNjIFjDWoJgRgSiu64';
const OPPS_TAB_NAME  = 'Opportunities';   // must match your sheet tab name exactly

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function makeJWT(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const data = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  const sig = b64url(sign.sign(creds.private_key));
  return `${data}.${sig}`;
}

async function getToken(creds) {
  const jwt = makeJWT(creds);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('No access token: ' + JSON.stringify(j));
  return j.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT env var not set.');
    }
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const token = await getToken(creds);

    const range = encodeURIComponent(`'${OPPS_TAB_NAME}'!A:G`);
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);

    const values = j.values || [];
    if (values.length < 2) return res.json({ rows: [] });

    const headers = values[0].map(h => String(h || '').trim().toLowerCase());
    const rows = values.slice(1)
      .map(function(row) {
        const obj = {};
        headers.forEach(function(h, i) { if (h) obj[h] = row[i] != null ? String(row[i]) : ''; });
        return obj;
      })
      .filter(function(r) { return r.t; }); /* only rows with a title */

    return res.json({ rows });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
