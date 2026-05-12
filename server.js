/**
 * Velan Metrology Dashboard — Backend Proxy Server
 * ─────────────────────────────────────────────────
 * Sits between the browser and Google Sheets so CORS is never an issue.
 *
 * Architecture (from velan_dashboard_architecture.svg):
 *   Google Sheets (CSV export) → /api/sheets (this file) → React frontend
 *
 * Start:  node server.js
 * Port:   3000  (dashboard at http://localhost:3000)
 *
 * The SHEETS_URL env var (or the UI input) is the only thing you need to set.
 * Example Google Sheets CSV export URL format:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
 */
 
const http   = require('http');
const https  = require('https');
const url    = require('url');
const path   = require('path');
const fs     = require('fs');
 
const PORT        = process.env.PORT        || 3000;
const SHEETS_URL  = process.env.SHEETS_URL  || '';   // set via env or UI
const CACHE_TTL   = Number(process.env.CACHE_TTL) || 60; // seconds
 
// ── In-memory cache ──────────────────────────────────────────────────────────
let _cache = { data: null, ts: 0, url: '' };
 
function fetchRemote(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const mod    = parsed.protocol === 'https:' ? https : http;
    mod.get(targetUrl, { headers: { 'User-Agent': 'VelanDashboard/2.0' } }, res => {
      // Follow one redirect (Google Sheets sends 302 → real CSV)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchRemote(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${targetUrl}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end',  ()    => resolve(body));
    }).on('error', reject);
  });
}
 
async function getSheetData(sheetUrl) {
  const now = Date.now();
  if (_cache.data && _cache.url === sheetUrl && (now - _cache.ts) < CACHE_TTL * 1000) {
    return { data: _cache.data, cached: true, age: Math.round((now - _cache.ts) / 1000) };
  }
  const raw    = await fetchRemote(sheetUrl);
  _cache       = { data: raw, ts: now, url: sheetUrl };
  return { data: raw, cached: false, age: 0 };
}
 
// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname;
 
  // ── CORS headers (allows the browser to call the API) ──
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
 
  // ── GET /api/sheets?url=<encoded-sheets-url> ──────────────────────────────
  if (pathname === '/api/sheets' && req.method === 'GET') {
    const sheetUrl = parsed.query.url || SHEETS_URL;
 
    if (!sheetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'No sheet URL provided. Pass ?url=<google-sheets-csv-url> or set SHEETS_URL env var.',
        hint:  'Example: /api/sheets?url=https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv'
      }));
    }
 
    try {
      const result = await getSheetData(sheetUrl);
      res.writeHead(200, {
        'Content-Type':  'text/csv; charset=utf-8',
        'X-Cache':       result.cached ? `HIT age=${result.age}s` : 'MISS',
        'X-Source-URL':  sheetUrl.substring(0, 80),
      });
      return res.end(result.data);
    } catch (err) {
      console.error('[/api/sheets] fetch error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error:   'Failed to fetch Google Sheet.',
        detail:  err.message,
        hint:    'Make sure the sheet is shared as "Anyone with the link can view" and the URL ends with ?format=csv'
      }));
    }
  }
 
  // ── GET /api/health ───────────────────────────────────────────────────────
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status:    'ok',
      port:      PORT,
      cacheAge:  _cache.ts ? Math.round((Date.now() - _cache.ts) / 1000) : null,
      sheetUrl:  (SHEETS_URL || 'not set').substring(0, 60),
    }));
  }
 
  // ── Serve index.html for all other routes ─────────────────────────────────
  const staticFile = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
    const ext  = path.extname(staticFile);
    const mime = {
      '.html': 'text/html', '.js': 'text/javascript',
      '.css':  'text/css',  '.json': 'application/json',
      '.svg':  'image/svg+xml', '.png': 'image/png',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    return res.end(fs.readFileSync(staticFile));
  }
 
  // Default → serve index.html (SPA fallback)
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(indexPath));
  }
 
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});
 
server.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────────────────────┐`);
  console.log(`│  Velan Metrology Dashboard — Backend Proxy      │`);
  console.log(`│  http://localhost:${PORT}                          │`);
  console.log(`│  API:  http://localhost:${PORT}/api/sheets          │`);
  console.log(`│  Health: http://localhost:${PORT}/api/health        │`);
  console.log(`└─────────────────────────────────────────────────┘\n`);
  if (SHEETS_URL) {
    console.log(`  SHEETS_URL = ${SHEETS_URL.substring(0, 70)}`);
  } else {
    console.log(`  ⚠  No SHEETS_URL set. Use the dashboard UI or pass ?url= to /api/sheets`);
  }
});