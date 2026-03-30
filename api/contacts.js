const { google } = require('googleapis');

const SHEET_ID      = '12iRhnjYCYeLHc7onX7HRdwjeDpNjIFjDWoJgRgSiu64';
const CONTACTS_GID  = '812606877';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set.');
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties',
    });

    const match = (meta.data.sheets || []).find(
      s => String(s.properties.sheetId) === String(CONTACTS_GID)
    );
    const sheetName = match ? match.properties.title : null;
    const range = sheetName ? `'${sheetName}'!A:F` : 'A:F';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });

    const values = response.data.values || [];
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
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
