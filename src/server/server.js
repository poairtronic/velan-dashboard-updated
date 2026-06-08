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

const PORT       = process.env.PORT       || 10000;
const LIVE_URL    = process.env.LIVE_URL    || process.env.SHEETS_URL || '';
const HISTORY_URL = process.env.HISTORY_URL || '';
const CACHE_TTL   = Number(process.env.CACHE_TTL) || 60; // seconds

// ── Neon PostgreSQL connection (with MockPool fallback for local testing) ─────
let pool;
const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL === 'mock';

if (!isMock) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,                  // max 5 concurrent connections (Neon free tier safe)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  class MockPool {
    constructor() {
      this.rows = [];
      this.liveRows = [];
      this.syncLogs = [];
    }
    async connect() {
      return {
        query: async (sql, params) => this.query(sql, params),
        release: () => {}
      };
    }
    async query(sql, params) {
      const cleanSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();
      if (cleanSql.includes('CREATE TABLE') || cleanSql.includes('CREATE INDEX') || cleanSql.includes('BEGIN') || cleanSql.includes('COMMIT') || cleanSql.includes('DROP TABLE')) {
        return { rowCount: 0, rows: [] };
      }
      if (cleanSql.includes('SELECT COUNT(*) FROM VELAN_ROWS WHERE ROW_KEY')) {
        return { rows: [{ count: 0 }] };
      }
      if (cleanSql.includes('SELECT CREATED_AT FROM SYNC_LOGS')) {
        return { rows: this.syncLogs.slice(0, 1) };
      }
      if (cleanSql.includes('SELECT DATA FROM VELAN_ROWS')) {
        return { rows: this.rows };
      }
      if (cleanSql.includes('SELECT DATA FROM VELAN_LIVE_ROWS')) {
        return { rows: this.liveRows };
      }
      if (cleanSql.includes('SELECT SYNC_TYPE')) {
        return { rows: this.syncLogs };
      }
      if (cleanSql.includes('SELECT COUNT(*) FROM VELAN_ROWS')) {
        return { rows: [{ count: this.rows.length }] };
      }
      if (cleanSql.includes('TRUNCATE VELAN_LIVE_ROWS') || cleanSql.includes('DELETE FROM VELAN_LIVE_ROWS')) {
        this.liveRows = [];
        return { rowCount: 0, rows: [] };
      }
      if (cleanSql.includes('DELETE FROM VELAN_ROWS')) {
        this.rows = [];
        return { rowCount: 0, rows: [] };
      }
      if (cleanSql.includes('INSERT INTO VELAN_LIVE_ROWS') || cleanSql.includes('INSERT INTO VELAN_ROWS')) {
        if (params) {
          for (let i = 0; i < params.length; i += 2) {
            const key = params[i];
            if (!params[i+1]) continue;
            const data = JSON.parse(params[i+1]);
            const rowObj = { row_key: key, data };
            if (cleanSql.includes('VELAN_LIVE_ROWS')) {
              const idx = this.liveRows.findIndex(r => r.row_key === key);
              if (idx >= 0) this.liveRows[idx] = rowObj;
              else this.liveRows.push(rowObj);
            } else {
              const idx = this.rows.findIndex(r => r.row_key === key);
              if (idx >= 0) this.rows[idx] = rowObj;
              else this.rows.push(rowObj);
            }
          }
        }
        return { rowCount: params ? params.length / 2 : 0, rows: [] };
      }
      if (cleanSql.includes('INSERT INTO SYNC_LOGS')) {
        const [sync_type, row_count, status] = params;
        const log = { sync_type, row_count, status, created_at: new Date().toISOString() };
        this.syncLogs.unshift(log);
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    }
    async end() {}
  }
  pool = new MockPool();
}

// ── Create tables and indices if they don't exist ─────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Create velan_rows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS velan_rows (
        id       SERIAL PRIMARY KEY,
        row_key  TEXT UNIQUE NOT NULL,
        data     JSONB NOT NULL,
        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Create velan_live_rows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS velan_live_rows (
        id       SERIAL PRIMARY KEY,
        row_key  TEXT UNIQUE NOT NULL,
        data     JSONB NOT NULL,
        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Create sync_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id         SERIAL PRIMARY KEY,
        sync_type  TEXT NOT NULL,
        row_count  INTEGER NOT NULL,
        status     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4. Create indices for speed optimization
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_key ON velan_rows (row_key)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_live_rows_key ON velan_live_rows (row_key)');

    await client.query('COMMIT');
    console.log('[DB] Neon tables and indices initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Neon initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Migration: Converts old row keys and deduplicates data ──────────────────
async function runKeyMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create temporary table with deduplicated latest entries
    await client.query(`
      CREATE TEMP TABLE temp_latest_rows AS
      SELECT DISTINCT ON (
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', '')
      ) id, data, added_at
      FROM velan_rows
      ORDER BY 
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', ''), 
        added_at DESC
    `);

    // Truncate existing rows
    await client.query('TRUNCATE velan_rows');

    // Re-insert deduplicated rows with the new key format
    await client.query(`
      INSERT INTO velan_rows (row_key, data, added_at)
      SELECT 
        COALESCE(data->>'sc', '') || '||' || 
        COALESCE(data->>'po', '') || '||' || 
        COALESCE(data->>'product', '') || '||' || 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', ''),
        data,
        added_at
      FROM temp_latest_rows
    `);

    await client.query('DROP TABLE temp_latest_rows');
    await client.query('COMMIT');
    console.log('[DB] Key migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Key migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Load all rows from Neon into memory ───────────────────────────────────────
// Also backfills currentStage from 'op' field for legacy rows imported before
// the OP→currentStage mapping was in place.
async function loadDB() {
  const res = await pool.query('SELECT data FROM velan_rows ORDER BY id');
  return res.rows.map(r => {
    const d = r.data;
    // Backfill: if currentStage is empty but op exists, use op
    if (!d.currentStage && d.op) {
      d.currentStage = String(d.op).trim();
    }
    // Also handle uppercase OP key (some imports may have stored it as-is)
    if (!d.currentStage && d.OP) {
      d.currentStage = String(d.OP).trim();
    }
    return d;
  });
}

// ── Load all live operational rows from Neon ─────────────────────────
async function loadLiveDB() {
  const res = await pool.query('SELECT data FROM velan_live_rows ORDER BY id');
  return res.rows.map(r => {
    const d = r.data;
    if (!d.currentStage && d.op) d.currentStage = String(d.op).trim();
    if (!d.currentStage && d.OP) d.currentStage = String(d.OP).trim();
    return d;
  });
}

// ── Insert Sync Log ───────────────────────────────────────────────────────────
async function logSync(syncType, rowCount, status) {
  try {
    await pool.query(
      `INSERT INTO sync_logs (sync_type, row_count, status)
       VALUES ($1, $2, $3)`,
      [syncType, rowCount, status]
    );
  } catch (err) {
    console.error('[logSync] Failed to log sync:', err.message);
  }
}

// ── Refactored Row Key Generator ──────────────────────────────────────────────
const makeKey = r =>
  `${r.sc||''}||${r.po||''}||${r.product||''}||${r.currentStage||''}`;

// ── Bulk Upsert archive rows into Neon ─────────────────────────────────────────
async function insertRows(rows) {
  if (!rows.length) return 0;
  
  // Deduplicate rows in-memory to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" PostgreSQL error
  const uniqueMap = new Map();
  rows.forEach(r => {
    const key = makeKey(r);
    const existing = uniqueMap.get(key);
    if (!existing || (r.timestamp && (!existing.timestamp || r.timestamp > existing.timestamp))) {
      uniqueMap.set(key, r);
    }
  });
  const uniqueRows = Array.from(uniqueMap.values());

  const client = await pool.connect();
  let upserted = 0;
  try {
    await client.query('BEGIN');
    const chunkSize = 500;
    for (let i = 0; i < uniqueRows.length; i += chunkSize) {
      const chunk = uniqueRows.slice(i, i + chunkSize);
      const valueStrings = [];
      const values = [];
      
      chunk.forEach((row, idx) => {
        const valIdx1 = idx * 2 + 1;
        const valIdx2 = idx * 2 + 2;
        valueStrings.push(`($${valIdx1}, $${valIdx2})`);
        values.push(makeKey(row), JSON.stringify(row));
      });
      
      const queryText = `
        INSERT INTO velan_rows (row_key, data)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (row_key) DO UPDATE SET data = EXCLUDED.data, added_at = NOW()
      `;
      const res = await client.query(queryText, values);
      upserted += res.rowCount;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return upserted;
}

// ── Bulk Replace/Upsert operational live snapshot rows in Neon ────────────────
async function saveLiveRows(rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE velan_live_rows');
    
    if (rows.length > 0) {
      // Deduplicate rows in-memory to prevent duplicate key constraint errors inside a single VALUES statement
      const uniqueMap = new Map();
      rows.forEach(r => {
        const key = makeKey(r);
        const existing = uniqueMap.get(key);
        if (!existing || (r.timestamp && (!existing.timestamp || r.timestamp > existing.timestamp))) {
          uniqueMap.set(key, r);
        }
      });
      const uniqueRows = Array.from(uniqueMap.values());

      const chunkSize = 500;
      for (let i = 0; i < uniqueRows.length; i += chunkSize) {
        const chunk = uniqueRows.slice(i, i + chunkSize);
        const valueStrings = [];
        const values = [];
        chunk.forEach((row, idx) => {
          const valIdx1 = idx * 2 + 1;
          const valIdx2 = idx * 2 + 2;
          valueStrings.push(`($${valIdx1}, $${valIdx2})`);
          values.push(makeKey(row), JSON.stringify(row));
        });
        const queryText = `
          INSERT INTO velan_live_rows (row_key, data)
          VALUES ${valueStrings.join(', ')}
          ON CONFLICT (row_key) DO UPDATE SET data = EXCLUDED.data, added_at = NOW()
        `;
        await client.query(queryText, values);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Security Helpers & Middlewares ───────────────────────────────────────────

function requireApiKey(req, res) {
  if (!process.env.API_SECRET) return true;
  const key = req.headers['x-api-key'];
  if (key === process.env.API_SECRET) return true;

  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid API Key' }));
  return false;
}

function validateSheetsUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Whitelist docs.google.com and docs.googleusercontent.com
    const isWhitelisted = hostname === 'docs.google.com' || hostname === 'docs.googleusercontent.com';
    if (!isWhitelisted) return false;

    // Explicit SSRF protection against loopbacks
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return false;

    return true;
  } catch (e) {
    return false;
  }
}

const rateLimitStore = new Map();

function rateLimiter(req, res, maxRequests = 10, windowMs = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
  const now = Date.now();
  if (!rateLimitStore.has(ip)) rateLimitStore.set(ip, []);
  
  const timestamps = rateLimitStore.get(ip);
  const activeTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (activeTimestamps.length >= maxRequests) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': Math.round(windowMs / 1000) });
    res.end(JSON.stringify({ success: false, error: 'Too Many Requests. Rate limit exceeded.' }));
    return false;
  }
  
  activeTimestamps.push(now);
  rateLimitStore.set(ip, activeTimestamps);
  return true;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://docs.google.com https://docs.googleusercontent.com; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none';"
  );
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

  // ── Apply Security Headers ────────────────────────────────────────────────
  applySecurityHeaders(res);

  // ── CORS headers ──────────────────────────────────────────────────────────
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const origin = req.headers.origin || '';
  
  if (allowedOrigin) {
    const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    if (origin === allowedOrigin || isLocal) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  const rateLimitedPaths = [
    '/api/data',
    '/api/import',
    '/api/reset',
    '/api/migrate',
    '/api/sheets',
    '/api/security-status'
  ];
  
  if (rateLimitedPaths.includes(pathname)) {
    const limit = (pathname === '/api/data' && req.method === 'GET') ? 60 : 10;
    if (!rateLimiter(req, res, limit, 60000)) return;
  }

  // ── GET /api/data ─────────────────────────────────────────────────────────
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const dbRows = await loadDB();
      const liveDbRows = await loadLiveDB();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        rows:     dbRows,
        liveRows: liveDbRows.length > 0 ? liveDbRows : dbRows,
        lastSync: _lastSync,
        total:    dbRows.length,
      }));
    } catch (err) {
      console.error('[GET /api/data] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/data — replace live snapshot AND save new rows to Neon ──────
  if (pathname === '/api/data' && req.method === 'POST') {
    if (!requireApiKey(req, res)) return;
    let syncType = 'Manual Upload';
    let incomingLength = 0;
    try {
      const body     = await readBody(req);
      const payload  = JSON.parse(body);
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];
      incomingLength = incoming.length;

      // Extract sync_type query parameter if present
      const queryType = parsed.searchParams.get('sync_type');
      if (queryType) {
        syncType = queryType;
      }

      // 1. Replace the live snapshot table in database
      await saveLiveRows(incoming);
      _liveRows = incoming;

      // 2. Save/Upsert new rows to velan_rows in Neon
      const saved = await insertRows(incoming);
      
      _db = await loadDB();
      _lastSync = new Date().toLocaleString('en-IN');

      // 3. Log the successful sync
      await logSync(syncType, incomingLength, 'success');

      console.log(`[POST /api/data] Live: ${incoming.length} | DB: ${_db.length} (+${saved} upserted to Neon)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:   true,
        liveTotal: incoming.length,
        total:     _db.length,
        newRows:   saved,
        lastSync:  _lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/data] failed:', err.message);
      await logSync(syncType, incomingLength, 'failed');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── DELETE /api/data — wipe all rows from Neon ────────────────────────────
  if (pathname === '/api/data' && req.method === 'DELETE') {
    if (!requireApiKey(req, res)) return;
    try {
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
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
    if (!requireApiKey(req, res)) return;
    try {
      // 1. Wipe Neon
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
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

      await logSync('History Import', rows.length, 'success');

      console.log(`[POST /api/reset] Re-imported ${imported} rows | DB now: ${_db.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, imported, total: _db.length, lastSync: _lastSync }));
    } catch (err) {
      console.error('[POST /api/reset]', err.message);
      await logSync('History Import', 0, 'failed');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/import — append to Neon DB with dedup ──────────────────────
  if (pathname === '/api/import' && req.method === 'POST') {
    if (!requireApiKey(req, res)) return;
    let incomingLength = 0;
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
      incomingLength = incoming.length;

      // If replace=true, wipe Neon first
      if (payload.replace === true) {
        await pool.query('DELETE FROM velan_rows');
        await pool.query('DELETE FROM velan_live_rows');
        _db       = [];
        _liveRows = [];
        console.log('[POST /api/import] replace=true → wiped existing Neon rows');
      }

      const imported = await insertRows(incoming);
      _db = await loadDB();
      _lastSync = new Date().toLocaleString('en-IN');

      await logSync('History Import', incomingLength, 'success');

      console.log(`[POST /api/import] Imported/Updated: ${imported} | DB: ${_db.length}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:  true,
        imported,
        skipped:  incomingLength - imported,
        total:    _db.length,
        lastSync: _lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/import] failed:', err.message);
      await logSync('History Import', incomingLength, 'failed');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── GET /api/sync-status — retrieve sync logs ────────────────────────────
  if (pathname === '/api/sync-status' && req.method === 'GET') {
    try {
      const logsRes = await pool.query('SELECT sync_type, row_count, status, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        logs: logsRes.rows,
      }));
    } catch (err) {
      console.error('[GET /api/sync-status] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/migrate — fix legacy rows missing currentStage ────────────
  // One-time operation: updates all Neon rows where currentStage is empty
  // but op/OP field contains the stage value (rows imported before field mapping fix).
  if (pathname === '/api/migrate' && req.method === 'POST') {
    if (!requireApiKey(req, res)) return;
    try {
      // Fetch all rows
      const allRes = await pool.query('SELECT id, row_key, data FROM velan_rows');
      let fixed = 0;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const row of allRes.rows) {
          const d = row.data;
          let changed = false;
          // Fix currentStage from op or OP
          if (!d.currentStage || d.currentStage === '') {
            const stage = d.op || d.OP || '';
            if (stage) {
              d.currentStage = String(stage).trim();
              changed = true;
            }
          }
          if (changed) {
            // Also update the row_key since currentStage changed
            const newKey = `${d.sc||''}||${d.po||''}||${d.product||''}||${d.currentStage||''}`;
            await client.query(
              'UPDATE velan_rows SET data = $1, row_key = $2 WHERE id = $3',
              [JSON.stringify(d), newKey, row.id]
            );
            fixed++;
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      // Reload DB into memory
      _db = await loadDB();
      console.log(`[POST /api/migrate] Fixed ${fixed} rows | DB now: ${_db.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, fixed, total: _db.length }));
    } catch (err) {
      console.error('[POST /api/migrate]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
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

  // ── GET /api/health ───────────────────────────────────────────────────────
  // ── GET /api/config — send env URLs to frontend ──────────────────────────
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      liveUrl:    LIVE_URL    || null,
      historyUrl: HISTORY_URL || null,
    }));
  }

  // ── GET /api/security-status — retrieve security status ──────────────────
  if (pathname === '/api/security-status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      apiSecretEnabled:       !!process.env.API_SECRET,
      corsRestricted:         !!process.env.ALLOWED_ORIGIN,
      sheetsWhitelistEnabled: true,
      rateLimitingEnabled:    true
    }));
  }
  if (pathname === '/api/health') {
    let database = 'connected';
    let rows = 0;
    try {
      const dbRes = await pool.query('SELECT COUNT(*) FROM velan_rows');
      rows = Number(dbRes.rows[0].count);
    } catch (e) {
      database = 'disconnected: ' + e.message;
    }
    const uptime = Math.round(process.uptime()) + 's';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      database,
      rows,
      lastSync: _lastSync || 'never',
      uptime,
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
  if (isMock) {
    console.warn('\n[WARNING] DATABASE_URL is not set or set to mock. Running with in-memory MockPool database.');
  } else {
    console.log('\n[DB] Connecting to Neon PostgreSQL…');
  }
  await initDB();

  // Run migration check automatically at startup
  try {
    const checkRes = await pool.query("SELECT COUNT(*) FROM velan_rows WHERE row_key LIKE '%||%||%||%||%'");
    if (Number(checkRes.rows[0].count) > 0) {
      console.log('[DB] Migration needed: Converting old row keys and deduplicating...');
      await runKeyMigration();
    }
  } catch (err) {
    console.error('[DB] Pre-startup migration check failed:', err.message);
  }

  // Load last sync timestamp from logs
  try {
    const syncRes = await pool.query("SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1");
    if (syncRes.rows.length > 0) {
      _lastSync = new Date(syncRes.rows[0].created_at).toLocaleString('en-IN');
    }
  } catch (_) {}

  _db = await loadDB();
  const liveDb = await loadLiveDB();
  _liveRows = liveDb;
  console.log(`[DB] Loaded ${_db.length} archive rows and ${_liveRows.length} live rows from Neon`);

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
    console.log(`  DB rows: ${_db.length} archive rows | ${_liveRows.length} live rows`);
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