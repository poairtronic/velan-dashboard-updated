/**
 * Velan Metrology Dashboard — Backend Server
 * ──────────────────────────────────────────
 * Endpoints:
 *   GET  /api/data          → return historical DB rows + live rows
 *   POST /api/data          → replace live operational snapshot
 *   POST /api/import        → append rows to permanent DB (dedup)
 *   GET  /api/sheets?url=   → proxy-fetch Google Sheets CSV (bypasses CORS)
 *   GET  /api/health        → server status
 *   GET  /                  → serves index.html
 *
 * Start:  node server.js
 * Port:   3000
 */

const http   = require('http');
const https  = require('https');
const url    = require('url');
const path   = require('path');
const fs     = require('fs');
const PORT = process.env.PORT || 10000;
const SHEETS_URL = process.env.SHEETS_URL || '';
const CACHE_TTL  = Number(process.env.CACHE_TTL) || 60; // seconds

// ── Persistent JSON data store ────────────────────────────────────────────────
// RENDER DEPLOYMENT: The default path (__dirname/velan_db.json) is on an
// ephemeral filesystem that resets on every deploy.
// FIX: In Render dashboard → Environment → add:
//   DB_FILE = /var/data/velan_db.json
// and attach a Persistent Disk mounted at /var/data
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'velan_db.json');
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw    = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('[DB] Failed to load velan_db.json:', e.message);
  }
  return [];
}
function saveDB(rows) {
  try {
    if (!Array.isArray(rows)) {
      console.error('[DB] Invalid rows format');
      return;
    }

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(rows, null, 2),
      'utf8'
    );

    console.log(`[DB] Saved ${rows.length} rows`);
  } catch (e) {
    console.error('[DB] Failed to save DB:', e.message);
  }
}
// In-memory state
let _db       = loadDB();   // permanent historical archive — NEVER overwritten by live upload
let _liveRows = [];         // current operational snapshot — replaced on every upload
let _lastSync = '';
// ── In-memory Google Sheets cache ────────────────────────────────────────────
let _cache = { data: null, ts: 0, url: '' };

// ── Remote fetch with redirect following ─────────────────────────────────────
function fetchRemote(targetUrl) {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    function doFetch(fetchUrl) {
      if (redirectCount > 10) return reject(new Error('Too many redirects'));
      let parsedUrl;
      try { parsedUrl = new URL(fetchUrl); }
      catch (e) { return reject(new Error('Invalid URL: ' + fetchUrl)); }
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      const reqObj = mod.get(fetchUrl, { headers: { 'User-Agent': 'VelanDashboard/2.0' }, timeout: 25000 }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          redirectCount++;
          // Resolve relative redirects
          let nextUrl = res.headers.location;
          if (nextUrl.startsWith('/')) {
            nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
          }
          return doFetch(nextUrl);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${fetchUrl}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end',  ()    => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }).on('error', reject);
      reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('Request timed out after 25s')); });
    }
    doFetch(targetUrl);
  });
}

async function getSheetData(sheetUrl) {
  const now = Date.now();
  if (_cache.data && _cache.url === sheetUrl && (now - _cache.ts) < CACHE_TTL * 1000) {
    return { data: _cache.data, cached: true, age: Math.round((now - _cache.ts) / 1000) };
  }
  const raw = await fetchRemote(sheetUrl);
  _cache    = { data: raw, ts: now, url: sheetUrl };
  return { data: raw, cached: false, age: 0 };
}

// ── Helper: read full POST body ───────────────────────────────────────────────
const MAX_BODY = 50 * 1024 * 1024; // 50 MB limit
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLen = 0;
    req.on('data', chunk => {
      totalLen += chunk.length;
      if (totalLen > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large (max 50 MB)'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end',   () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  let parsed;
  try {
    parsed = new URL(req.url, `http://localhost`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }
  const pathname = parsed.pathname;

  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── GET /api/data ─────────────────────────────────────────────────────────
  if (pathname === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      rows:     _db,
      liveRows: _liveRows.length > 0 ? _liveRows : _db,
      lastSync: _lastSync,
      total:    _db.length,
    }));
  }

  // ── POST /api/data — replace live snapshot AND accumulate into DB ─────────
  if (pathname === '/api/data' && req.method === 'POST') {
    try {
      const body    = await readBody(req);
      const payload = JSON.parse(body);
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];

      // 1. Replace the live snapshot (what all operational pages see)
      _liveRows = incoming;

      // 2. Also merge incoming rows into the permanent DB (dedup by key)
      //    This means every live upload automatically goes into the database too.
      const makeKey = r =>
        `${r.sc||''}||${r.po||''}||${r.product||''}||${r.currentStage||''}||${r.timestamp||''}`;

      const existingKeys = new Set(_db.map(makeKey));
      let newRows = 0;

      incoming.forEach(row => {
        const k = makeKey(row);
        if (!existingKeys.has(k)) {
          _db.push(row);
          existingKeys.add(k);
          newRows++;
        }
      });

      // 3. Save the updated DB to disk
      saveDB(_db);
      _lastSync = new Date().toLocaleString('en-IN');

      console.log(`[POST /api/data] Live: ${_liveRows.length} rows | DB: ${_db.length} rows (+${newRows} new)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:   true,
        liveTotal: _liveRows.length,
        total:     _db.length,
        newRows,
        lastSync:  _lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/data]', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
  // ── POST /api/import — append to permanent DB with dedup ─────────────────
  if (pathname === '/api/import' && req.method === 'POST') {
    try {
      const body    = await readBody(req);
      const payload = JSON.parse(body);
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];

      const makeKey = r =>
        `${r.sc||''}||${r.po||''}||${r.product||''}||${r.currentStage||''}||${r.timestamp||''}`;

      const existingKeys = new Set(_db.map(makeKey));
      let imported = 0, skipped = 0;

      incoming.forEach(row => {
        const k = makeKey(row);
        if (!existingKeys.has(k)) {
          _db.push(row);
          existingKeys.add(k);
          imported++;
        } else {
          skipped++;
        }
      });

      saveDB(_db);
      _lastSync = new Date().toLocaleString('en-IN');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:  true,
        imported,
        skipped,
        total:    _db.length,
        lastSync: _lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/import]', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── GET /api/sheets?url=<google-sheets-csv-url> ───────────────────────────
  if (pathname === '/api/sheets' && req.method === 'GET') {
    const sheetUrl = parsed.searchParams.get('url') || SHEETS_URL;
    

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
        hint:   'Make sure the sheet is shared as "Anyone with the link can view"',
      }));
    }
  }

  // ── GET /api/health ───────────────────────────────────────────────────────
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status:   'ok',
      port:     PORT,
      dbRows:   _db.length,
      liveRows: _liveRows.length,
      lastSync: _lastSync || 'never',
      cacheAge: _cache.ts ? Math.round((Date.now() - _cache.ts) / 1000) : null,
      sheetUrl: (SHEETS_URL || 'not set').substring(0, 60),
    }));
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const staticFile = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  // Security: prevent path traversal outside __dirname
  if (!staticFile.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }
  if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
    const ext  = path.extname(staticFile);
    const mime = {
      '.html': 'text/html',
      '.js':   'text/javascript',
      '.css':  'text/css',
      '.json': 'application/json',
      '.svg':  'image/svg+xml',
      '.png':  'image/png',
      '.ico':  'image/x-icon',
      '.woff2':'font/woff2',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    return res.end(fs.readFileSync(staticFile));
  }

  // ── SPA fallback → index.html ─────────────────────────────────────────────
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
  console.log(`│  Velan Metrology Dashboard — Backend Server     │`);
  console.log(`│  http://localhost:${PORT}                          │`);
  console.log(`│  Data:   http://localhost:${PORT}/api/data          │`);
  console.log(`│  Import: http://localhost:${PORT}/api/import        │`);
  console.log(`│  Sheets: http://localhost:${PORT}/api/sheets        │`);
  console.log(`│  Health: http://localhost:${PORT}/api/health        │`);
  console.log(`└─────────────────────────────────────────────────┘\n`);
  console.log(`  DB file:  ${DB_FILE}`);
  console.log(`  DB rows:  ${_db.length} rows loaded from disk`);
  if (SHEETS_URL) {
    console.log(`  SHEETS_URL = ${SHEETS_URL.substring(0, 70)}`);
  } else {
    console.log(`  ⚠  No SHEETS_URL set. Use dashboard UI or pass ?url= to /api/sheets`);
  }
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — saving DB and shutting down...`);
  saveDB(_db);
  server.close(() => {
    console.log('[Server] Closed. Goodbye.');
    process.exit(0);
  });
  // Force exit after 5 seconds if connections hang
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));