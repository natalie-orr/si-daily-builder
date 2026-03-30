import { google } from 'googleapis';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for required environment variables
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '12iRhnjYCYeLHc7onX7HRdwjeDpNjIFjDWoJgRgSiu64';

    if (!credentials) {
      return res.status(500).json({ 
        error: 'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add your Google service account JSON key.' 
      });
    }

    // Parse the service account credentials
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(credentials);
    } catch (e) {
      return res.status(500).json({ 
        error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.' 
      });
    }

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data from the Contacts sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Contacts!A2:F', // Assuming headers in row 1: Name, Status, Role, Org, Next Action, History
    });

    const rows = response.data.values || [];

    // Map rows to contact objects
    const contacts = rows.map(row => ({
      n: row[0] || '',  // Name
      s: row[1] || 'cold', // Status (hot, warm, cold, parked)
      r: row[2] || '',  // Role
      o: row[3] || '',  // Organization
      x: row[4] || '',  // Next action
      h: row[5] || '',  // History
    })).filter(c => c.n); // Filter out empty rows

    return res.status(200).json({ rows: contacts });

  } catch (error) {
    console.error('Google Sheets API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch contacts from Google Sheets' 
    });
  }
}
