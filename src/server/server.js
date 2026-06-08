/**
 * Velan Metrology Dashboard — Backend Server Orchestrator
 * ──────────────────────────────────────────────────────
 * Refactored modular entry point.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const { pool, isMock, initDB, runKeyMigration, loadDB, loadLiveDB } = require('./db/pool');
const state = require('./state');
const { rateLimiter, applySecurityHeaders } = require('./utils/helpers');

// Routes
const handleDataRoutes = require('./routes/data');
const handleImportRoutes = require('./routes/import');
const handleSheetsRoutes = require('./routes/sheets');
const handleHealthRoute = require('./routes/health');
const handleConfigRoutes = require('./routes/config');

const PORT = process.env.PORT || 10000;
const LIVE_URL = process.env.LIVE_URL || process.env.SHEETS_URL || '';
const HISTORY_URL = process.env.HISTORY_URL || '';

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

  // ── API Routing ───────────────────────────────────────────────────────────
  if (['/api/data', '/api/sync-status', '/api/migrate'].includes(pathname)) {
    return handleDataRoutes(req, res, pathname, req.method, parsed);
  }

  if (['/api/import', '/api/reset'].includes(pathname)) {
    return handleImportRoutes(req, res, pathname, req.method);
  }

  if (pathname === '/api/sheets') {
    return handleSheetsRoutes(req, res, pathname, parsed);
  }

  if (pathname === '/api/health') {
    return handleHealthRoute(req, res, pathname);
  }

  if (['/api/config', '/api/security-status'].includes(pathname)) {
    return handleConfigRoutes(req, res, pathname);
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const distDir = path.resolve(__dirname, '..', '..', 'dist');
  const clientDir = fs.existsSync(distDir) ? distDir : path.join(__dirname, '..', 'client');
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
  const indexPath = path.join(clientDir, 'index.html');
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
      state._lastSync = new Date(syncRes.rows[0].created_at).toLocaleString('en-IN');
    }
  } catch (_) {}

  state._db = await loadDB();
  const liveDb = await loadLiveDB();
  state._liveRows = liveDb;
  console.log(`[DB] Loaded ${state._db.length} archive rows and ${state._liveRows.length} live rows from Neon`);

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
    console.log(`  DB rows: ${state._db.length} archive rows | ${state._liveRows.length} live rows`);
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