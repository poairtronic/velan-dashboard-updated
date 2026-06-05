/**
 * Velan Metrology Dashboard — Backend Server
 * ──────────────────────────────────────────
 * Storage: Neon PostgreSQL (replaces velan_db.json)
 * No Persistent Disk needed. Works on Render free tier.
 *
 * Endpoints:
 *   GET  /api/data          → return historical DB rows + live rows
 *   POST /api/data          → replace live snapshot AND save new rows to Neon
 *   POST /api/import        → append rows to Neon DB (dedup)
 *   GET  /api/sheets?url=   → proxy-fetch Google Sheets CSV (bypasses CORS)
 *   GET  /api/health        → server + DB status
 *   GET  /                  → serves index.html
 *
 * Required env var:  DATABASE_URL = your Neon connection string
 * Optional env var:  SHEETS_URL, CACHE_TTL, PORT
 *
 * Start:  node server.js
 */

const http  = require('http');
const https = require('https');
const path  = require('path');
const fs    = require('fs');
const { Pool } = require('pg');

const PORT       = process.env.PORT       || 10000;
const LIVE_URL    = process.env.LIVE_URL    || process.env.SHEETS_URL || '';
const HISTORY_URL = process.env.HISTORY_URL || '';
const CACHE_TTL   = Number(process.env.CACHE_TTL) || 60; // seconds

// ── Neon PostgreSQL connection ────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,                  // max 5 concurrent connections (Neon free tier safe)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ── Create table if it doesn't exist ─────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS velan_rows (
      id       SERIAL PRIMARY KEY,
      row_key  TEXT UNIQUE NOT NULL,
      data     JSONB NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[DB] Neon table ready');
}

// ── Load all rows from Neon into memory ───────────────────────────────────────
async function loadDB() {
  const res = await pool.query('SELECT data FROM velan_rows ORDER BY id');
  return res.rows.map(r => r.data);
}

// ── Insert only NEW rows into Neon (skips duplicates via row_key) ─────────────
const makeKey = r =>
  `${r.sc||''}||${r.po||''}||${r.product||''}||${r.currentStage||''}||${r.timestamp||''}`;

async function insertRows(rows) {
  if (!rows.length) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const res = await client.query(
        `INSERT INTO velan_rows (row_key, data)
         VALUES ($1, $2)
         ON CONFLICT (row_key) DO NOTHING`,
        [makeKey(row), JSON.stringify(row)]
      );
      if (res.rowCount > 0) inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

// ── In-memory state ───────────────────────────────────────────────────────────
let _db       = [];   // full archive — loaded from Neon at startup
let _liveRows = [];   // current operational snapshot — replaced on every upload
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
      const reqObj = mod.get(
        fetchUrl,
        { headers: { 'User-Agent': 'VelanDashboard/2.0' }, timeout: 25000 },
        res => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            redirectCount++;
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
        }
      ).on('error', reject);
      reqObj.on('timeout', () => {
        reqObj.destroy();
        reject(new Error('Request timed out after 25s'));
      });
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

// ── Parse CSV text into row objects ──────────────────────────────────────────
// Handles quoted fields and ALL Velan column name variants correctly.
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Proper quoted-CSV parser
  function parseLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  // Normalize header key
  const normKey = h => String(h).trim().toLowerCase().replace(/[\s\/\-]+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Find header row
  let hIdx = 0;
  while (hIdx < lines.length && !lines[hIdx].trim()) hIdx++;
  const headers = parseLine(lines[hIdx]).map(normKey);

  // Pick first non-empty value from obj by alias list
  const pick = (obj, ...aliases) => {
    for (const a of aliases) {
      const v = obj[a];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const rows = [];
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseLine(lines[i]);
    const obj  = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });

    // Map ALL Velan column variants to canonical names
    const sc           = pick(obj, 'sc', 'sc_no', 'sc_number', 'scno');
    const po           = pick(obj, 'po_no', 'po', 'po_number', 'pono', 'purchase_order');
    const poDate       = pick(obj, 'po_recd_date', 'po_date', 'podate', 'date_received', 'date');
    const product      = pick(obj, 'product_name', 'product', 'item', 'description', 'item_description');
    const status1      = pick(obj, 'status_1', 'status1', 'current_operation', 'operation');
    const status2      = pick(obj, 'status_2', 'status2', 'next_operation');
    // OP column is the stage — critical mapping
    const currentStage = pick(obj, 'op', 'currentstage', 'current_stage', 'stage', 'operation_stage');
    const inhouse      = pick(obj, 'inhouse__vendor', 'inhouse_vendor', 'inhouse', 'location', 'vendor_status');
    const qty          = pick(obj, 'qty', '_qty', 'quantity');
    const timestamp    = pick(obj, 'timestamp', 'time_stamp', 'last_updated', 'op_time', 'datetime');

    if (!sc && !po) continue;
    rows.push({ sc, po, poDate, product, status1, status2, currentStage, inhouse, qty, timestamp });
  }
  return rows;
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

  // ── POST /api/data — replace live snapshot AND save new rows to Neon ──────
  if (pathname === '/api/data' && req.method === 'POST') {
    try {
      const body     = await readBody(req);
      const payload  = JSON.parse(body);
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];

      // 1. Replace the live snapshot
      _liveRows = incoming;

      // 2. Find new rows not already in _db (dedup in memory)
      const existingKeys = new Set(_db.map(makeKey));
      const newRows = [];
      incoming.forEach(row => {
        const k = makeKey(row);
        if (!existingKeys.has(k)) {
          _db.push(row);
          existingKeys.add(k);
          newRows.push(row);
        }
      });

      // 3. Save only new rows to Neon
      const saved = await insertRows(newRows);
      _lastSync = new Date().toLocaleString('en-IN');

      console.log(`[POST /api/data] Live: ${_liveRows.length} | DB: ${_db.length} (+${saved} new to Neon)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:   true,
        liveTotal: _liveRows.length,
        total:     _db.length,
        newRows:   saved,
        lastSync:  _lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/data]', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/import — append to Neon DB with dedup ──────────────────────

  // ── DELETE /api/data — wipe all rows from Neon ────────────────────────────
  if (pathname === '/api/data' && req.method === 'DELETE') {
    try {
      await pool.query('DELETE FROM velan_rows');
      _db       = [];
      _liveRows = [];
      _lastSync = '';
      console.log('[DELETE /api/data] All rows wiped from Neon DB');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'All rows deleted from database.' }));
    } catch (err) {
      console.error('[DELETE /api/data]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/reset — wipe Neon + optionally re-import from HISTORY_URL ──
  if (pathname === '/api/reset' && req.method === 'POST') {
    try {
      // 1. Wipe Neon
      await pool.query('DELETE FROM velan_rows');
      _db       = [];
      _liveRows = [];
      _lastSync = '';
      console.log('[POST /api/reset] Neon DB wiped');

      // 2. Re-import from HISTORY_URL env var (if set)
      const histUrl = HISTORY_URL;
      if (!histUrl) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'DB wiped. No HISTORY_URL set — nothing imported.', total: 0 }));
      }

      console.log('[POST /api/reset] Fetching fresh data from HISTORY_URL…');
      const raw  = await fetchRemote(histUrl);
      const rows = parseCSV(raw);

      const imported = await insertRows(rows);
      _db       = await loadDB();
      _lastSync = new Date().toLocaleString('en-IN');

      console.log(`[POST /api/reset] Re-imported ${imported} rows | DB now: ${_db.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, imported, total: _db.length, lastSync: _lastSync }));
    } catch (err) {
      console.error('[POST /api/reset]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (pathname === '/api/import' && req.method === 'POST') {
    try {
      const body    = await readBody(req);
      const payload = JSON.parse(body);

      let incoming = [];

      // Support two modes:
      // 1. { rows: [...] }         — caller sends pre-parsed rows
      // 2. { url: '...', replace: true/false } — fetch CSV from URL
      if (Array.isArray(payload.rows) && payload.rows.length > 0) {
        incoming = payload.rows;
      } else if (typeof payload.url === 'string' && payload.url.trim()) {
        console.log(`[POST /api/import] Fetching CSV from URL: ${payload.url.substring(0, 80)}…`);
        const raw = await fetchRemote(payload.url.trim());
        incoming  = parseCSV(raw);
        console.log(`[POST /api/import] Parsed ${incoming.length} rows from CSV`);
      }

      // If replace=true, wipe Neon first
      if (payload.replace === true) {
        await pool.query('DELETE FROM velan_rows');
        _db       = [];
        _liveRows = [];
        console.log('[POST /api/import] replace=true → wiped existing Neon rows');
      }

      // Dedup against in-memory _db
      const existingKeys = new Set(_db.map(makeKey));
      const newRows = [];
      incoming.forEach(row => {
        const k = makeKey(row);
        if (!existingKeys.has(k)) {
          _db.push(row);
          existingKeys.add(k);
          newRows.push(row);
        }
      });

      const imported = await insertRows(newRows);
      const skipped  = incoming.length - newRows.length;
      _lastSync = new Date().toLocaleString('en-IN');

      console.log(`[POST /api/import] Imported: ${imported} | Skipped: ${skipped} | DB: ${_db.length}`);

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
    const sheetUrl = parsed.searchParams.get('url') || LIVE_URL;
    if (!sheetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'No sheet URL provided. Pass ?url=<url> or set SHEETS_URL env var.',
        hint:  'Publish to web → Entire Document → CSV → copy the /pub?output=csv link',
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

  // ── GET /api/health ───────────────────────────────────────────────────────
  // ── GET /api/config — send env URLs to frontend ──────────────────────────
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      liveUrl:    LIVE_URL    || null,
      historyUrl: HISTORY_URL || null,
    }));
  }
  if (pathname === '/api/health') {
    let dbStatus = 'ok';
    try { await pool.query('SELECT 1'); } catch (e) { dbStatus = 'error: ' + e.message; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status:   'ok',
      port:     PORT,
      dbRows:   _db.length,
      liveRows: _liveRows.length,
      lastSync: _lastSync || 'never',
      dbStatus,
      storage:  'neon-postgresql',
      cacheAge: _cache.ts ? Math.round((Date.now() - _cache.ts) / 1000) : null,
    }));
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const clientDir = path.join(__dirname, '..', 'client');
  const staticFile = path.join(clientDir, pathname === '/' ? 'index.html' : pathname);
  if (!staticFile.startsWith(clientDir)) {
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
  const indexPath = path.join(__dirname, '..', 'client', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(indexPath));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// ── Startup: init Neon table → load rows → start listening ───────────────────
async function startup() {
  if (!process.env.DATABASE_URL) {
    console.error('\n[FATAL] DATABASE_URL is not set.');
    console.error('  → Go to Render → Environment → Add: DATABASE_URL = <your Neon connection string>\n');
    process.exit(1);
  }
  console.log('\n[DB] Connecting to Neon PostgreSQL…');
  await initDB();
  _db = await loadDB();
  console.log(`[DB] Loaded ${_db.length} rows from Neon`);

  server.listen(PORT, () => {
    console.log(`\n┌─────────────────────────────────────────────────┐`);
    console.log(`│  Velan Metrology Dashboard — Backend Server     │`);
    console.log(`│  http://localhost:${PORT}                          │`);
    console.log(`│  Data:   http://localhost:${PORT}/api/data          │`);
    console.log(`│  Import: http://localhost:${PORT}/api/import        │`);
    console.log(`│  Reset:  http://localhost:${PORT}/api/reset         │`);
    console.log(`│  Sheets: http://localhost:${PORT}/api/sheets        │`);
    console.log(`│  Health: http://localhost:${PORT}/api/health        │`);
    console.log(`└─────────────────────────────────────────────────┘`);
    console.log(`  Storage: Neon PostgreSQL (no local file needed)`);
    console.log(`  DB rows: ${_db.length} rows loaded`);
    console.log(`  LIVE_URL:    ${LIVE_URL    ? LIVE_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`);
    console.log(`  HISTORY_URL: ${HISTORY_URL ? HISTORY_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`);
    console.log('');
  });
}

startup().catch(err => {
  console.error('[STARTUP FAILED]', err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — closing Neon pool…`);
  await pool.end();
  server.close(() => {
    console.log('[Server] Closed. Goodbye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));