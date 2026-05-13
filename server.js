<<<<<<< HEAD
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
=======
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname)));

function ensureDataFolder() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { rows: [], lastSync: null };
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content || '{"rows":[],"lastSync":null}');
  } catch (err) {
    console.error('DB load error — return empty state:', err);
    return { rows: [], lastSync: null };
  }
}

function saveDb(db) {
  try {
    ensureDataFolder();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('DB save error — silent fail:', err);
  }
}

function normalizeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
// Canonical date parser — DD/MM/YYYY is the Velan standard (matches frontend)
function toIsoDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // DD/MM/YYYY or DD-MM-YYYY  (match[1]=day, match[2]=month, match[3]=year)
  const dmy = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const day   = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year  = dmy[3];
    return `${year}-${month}-${day}`;
  }
  // DD/MM/YY short year
  const dmyShort = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmyShort) {
    const day   = dmyShort[1].padStart(2, '0');
    const month = dmyShort[2].padStart(2, '0');
    const year  = parseInt(dmyShort[3]) >= 50 ? '19' + dmyShort[3] : '20' + dmyShort[3];
    return `${year}-${month}-${day}`;
  }
  return text;
}
function normalizeRow(raw) {
  const row = {
    sc:           normalizeString(raw.sc           || raw['SC']           || raw['SC NO']    || raw['SC No']),
    po:           normalizeString(raw.po           || raw['PO NO']        || raw['PO No']    || raw['PO']),
    poDate:       toIsoDate(normalizeString(raw.poDate || raw['PO RECD DATE'] || raw['PO Recd Date'] || raw['PO DATE'] || raw['PO Date'])),
    product:      normalizeString(raw.product      || raw['Product Name'] || raw['PRODUCT NAME'] || raw['Product']),
    type:         normalizeString(raw.type         || raw['TYPE']         || raw['Type']),
    status1:      normalizeString(raw.status1      || raw['STATUS 1']     || raw['Status 1'] || raw['STATUS1']),
    status2:      normalizeString(raw.status2      || raw['STATUS 2']     || raw['Status 2'] || raw['STATUS2']),
    inhouse:      normalizeString(raw.inhouse      || raw['INHOUSE/ VENDOR'] || raw['INHOUSE/VENDOR'] || raw['Inhouse/ Vendor']),
    currentStage: normalizeString(raw.currentStage || raw['currentStage'] || raw['CURRENT STAGE'] || raw['Current Stage']),
    timestamp:    toIsoDate(normalizeString(raw.timestamp ||raw['timestamp'] ||raw['TIMESTAMP'])),
    source:       normalizeString(raw.source || ''),
  };

  if (row.inhouse) {
    const up = row.inhouse.toUpperCase();
    row.inhouse = up.includes('VENDOR') ? 'VENDOR' : 'INHOUSE';
  }

  if (!row.type && row.product) {
    const p = row.product.toUpperCase();
    if (p.startsWith('APG')) row.type = 'APG';
    else if (p.startsWith('ARG')) row.type = 'ARG';
    else if (p.startsWith('SRG')) row.type = 'SRG';
    else if (p.startsWith('SPG')) row.type = 'SPG';
    else if (p.startsWith('SP ')) row.type = 'SP';
    else row.type = 'ACCESSORY';
  }

  return row;
}
function makeId(row) {
  return [row.sc, row.po, row.product, row.currentStage]
    .map(v => String(v || '').trim().toUpperCase())
    .join('_');
}
function rowKey(row) {
  return [row.sc, row.po, row.product, row.timestamp].map(v => String(v || '')).join('||');
}

function mergeRows(existingRows, incomingRows) {
  const normalizedIncoming = incomingRows.map(normalizeRow).filter(r => r.sc || r.po);
  const incomingKeys = new Set(normalizedIncoming.map(rowKey));

  // Build map from existing rows — preserve id if already set
  const existingMap = new Map(existingRows.map(row => [
    row._key || rowKey(row),
    { ...row, _key: row._key || rowKey(row), id: row.id || makeId(row) }
  ]));

  normalizedIncoming.forEach(row => {
    const key = rowKey(row);
    const id = makeId(row);
    if (existingMap.has(key)) {
      // Update existing row — keep original id
      const prev = existingMap.get(key);
      existingMap.set(key, {
        ...prev, ...row,
        id: prev.id || id,
        active: true,
        archived: false,
        lastSeen: new Date().toISOString(),
        _key: key,
      });
    } else {
      // New row — insert with id
      existingMap.set(key, {
        ...row,
        id,
        active: true,
        archived: false,
        insertedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        _key: key,
      });
    }
  });
  
  // Rows absent from incoming are KEPT PERMANENTLY — never deleted, never set inactive
  existingMap.forEach((row) => {
    if (!row.id) row.id = makeId(row);
    if (!row.insertedAt) row.insertedAt = new Date().toISOString();
    // Do NOT touch row.active — preserve whatever status it had
  });

  return Array.from(existingMap.values());
}
app.get('/api/data', (req, res) => {
  const db = loadDb();
  res.json({
    rows: db.rows || [],
    liveRows: db.liveRows || [],
    lastSync: db.lastSync,
  });
});
// Add AFTER line 120:

// GET /api/stats — lightweight count endpoint
app.get('/api/stats', (req, res) => {
  const db = loadDb();
  res.json({ total: db.rows.length, lastSync: db.lastSync });
});

// GET /api/sync — Google Sheet sync (configure URL via env var SHEET_CSV_URL)
app.get('/api/sync', async (req, res) => {
  const sheetUrl = process.env.SHEET_CSV_URL || '';
  if (!sheetUrl) {
    return res.json({
      success: false,
      message: 'No SHEET_CSV_URL env var set. Upload data via POST /api/data or the UI upload feature.',
    });
  }
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const response = await fetch(sheetUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    // Parse CSV rows (simple split — frontend parsers handle full XLSX)
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    const db = loadDb();
    // Google Sheet sync updates liveRows only — history is preserved in db.rows
    db.liveRows = rows
      .map(r => { const n = normalizeRow(r); return { ...n, id: makeId(n), source: 'LIVE', insertedAt: new Date().toISOString() }; })
      .filter(r => r.sc || r.po);
    db.lastSync = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, synced: rows.length, total: db.rows.length, liveTotal: db.liveRows.length, lastSync: db.lastSync });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.post('/api/data', (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.rows)) {
    return res.status(400).json({ error: 'Payload must contain rows array.' });
  }
  const db = loadDb();
  // Live upload REPLACES liveRows — it's the current operational snapshot
  // Historical db.rows is NEVER touched here
  db.liveRows = payload.rows
    .map(r => { const n = normalizeRow(r); return { ...n, id: makeId(n), source: 'LIVE', insertedAt: new Date().toISOString() }; })
    .filter(r => r.sc || r.po);
  db.lastSync = new Date().toISOString();
  saveDb(db);
  res.json({
    success: true,
    saved: db.liveRows.length,
    total: db.rows.length,
    liveTotal: db.liveRows.length,
    lastSync: db.lastSync,
  });
});
// POST /api/import — one-time historical bulk import (append-only, duplicate-safe)
app.post('/api/import', (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.rows)) {
    return res.status(400).json({ error: 'Payload must contain rows array.' });
  }
  const db = loadDb();
  const before = db.rows.length;
  const existingIds = new Set(db.rows.map(r => r.id || makeId(r)));
  const incoming = payload.rows
    .map(r => ({
      ...r,
      id: makeId(r),
      insertedAt: r.insertedAt || new Date().toISOString(),
      source: r.source || 'IMPORT'
    }))
    .filter(r => !existingIds.has(r.id));
  db.rows.push(...incoming);
  db.lastSync = db.lastSync || new Date().toISOString();
  saveDb(db);
  res.json({
    success: true,
    imported: incoming.length,
    skipped: payload.rows.length - incoming.length,
    total: db.rows.length,
    before,
  });
});

app.post('/api/clear', (req, res) => {
  const db = { rows: [], lastSync: new Date().toISOString() };
  saveDb(db);
  res.json({ success: true, cleared: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
>>>>>>> 63339d89d952aee3ce87f8fecfd09a67671f7f42
