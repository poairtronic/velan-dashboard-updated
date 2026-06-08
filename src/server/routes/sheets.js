const { validateSheetsUrl, getSheetData } = require('../utils/helpers');

const LIVE_URL = process.env.LIVE_URL || process.env.SHEETS_URL || '';

async function handleSheetsRoutes(req, res, pathname, parsed) {
  // ── GET /api/sheets?url=<google-sheets-csv-url> ───────────────────────────
  if (pathname === '/api/sheets' && req.method === 'GET') {
    const sheetUrl = parsed.searchParams.get('url') || LIVE_URL;
    if (!sheetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'No sheet URL provided. Pass ?url=<url> or set SHEETS_URL env var.',
        hint:  'Publish to web → Entire Document → CSV → copy the /pub?output=csv link',
      }));
    }
    
    // Validate target URL to prevent SSRF
    if (!validateSheetsUrl(sheetUrl)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Forbidden: Host is not whitelisted. Only Google Sheets URLs are permitted.',
        hint: 'Enter a valid URL from docs.google.com or docs.googleusercontent.com'
      }));
    }
    try {
      const result = await getSheetData(sheetUrl);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Cache':      result.cached ? `HIT age=${result.age}s` : 'MISS',
        'X-Source-URL': sheetUrl.substring(0, 80),
      });
      return res.end(result.data);
    } catch (err) {
      console.error('[/api/sheets] fetch error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error:  'Failed to fetch Google Sheet.',
        detail: err.message,
        hint:   'File → Share → Publish to web → Entire Document → CSV',
      }));
    }
  }
}

module.exports = handleSheetsRoutes;
