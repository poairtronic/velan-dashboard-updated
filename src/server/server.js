/**
 * Velan Metrology Dashboard — Backend Server Orchestrator
 * ──────────────────────────────────────────────────────
 * Refactored modular entry point using Express.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const app = require('./app');
const { env } = require('./config/env');
const { pool, isMock, initDB, runKeyMigration, getTotalCount, loadLiveDB } = require('./db/pool');
const state = require('./state');

// Initialize background workers
require('./workers/exportWorker');

const PORT = env.PORT;
const LIVE_URL = env.LIVE_URL || '';
const HISTORY_URL = env.HISTORY_URL || '';

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Startup: init Neon table → load rows → start listening ───────────────────
async function startup() {
  if (isMock) {
    console.warn(
      '\n[WARNING] DATABASE_URL is not set or set to mock. Running with in-memory MockPool database.'
    );
  } else {
    console.log('\n[DB] Connecting to Neon PostgreSQL…');
  }
  await initDB();

  // Run migration check automatically at startup
  try {
    const checkRes = await pool.query(
      "SELECT COUNT(*) FROM velan_rows WHERE row_key LIKE '%||%||%||%||%'"
    );
    if (Number(checkRes.rows[0].count) > 0) {
      console.log('[DB] Migration needed: Converting old row keys and deduplicating...');
      await runKeyMigration();
    }
  } catch (err) {
    console.error('[DB] Pre-startup migration check failed:', err.message);
  }

  // Load last sync timestamp from logs
  try {
    const syncRes = await pool.query(
      "SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1"
    );
    if (syncRes.rows.length > 0) {
      state._lastSync = new Date(syncRes.rows[0].created_at).toLocaleString('en-IN');
    }
  } catch (_) {}

  const totalCount = await getTotalCount();
  const liveDb = await loadLiveDB();
  state._liveRows = liveDb;
  console.log(
    `[DB] Loaded ${totalCount} archive rows and ${state._liveRows.length} live rows from Neon`
  );
  console.log('[STATIC] Serving from:', path.resolve(__dirname, '..', '..', 'dist'));
  console.log(
    '[STATIC] index.html exists:',
    fs.existsSync(path.join(path.resolve(__dirname, '..', '..', 'dist'), 'index.html'))
  );

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
    console.log(
      `  DB rows: ${totalCount} archive rows | ${state._liveRows.length} live rows`
    );
    console.log(`  LIVE_URL:    ${LIVE_URL ? LIVE_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`);
    console.log(
      `  HISTORY_URL: ${HISTORY_URL ? HISTORY_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`
    );
    console.log('');
  });
}

startup().catch((err) => {
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
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
