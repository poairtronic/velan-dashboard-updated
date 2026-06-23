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
const logger = require('./utils/logger');

// Initialize background workers
require('./workers/exportWorker');
require('./workers/syncWorker');
require('./workers/reportWorker');

const PORT = env.PORT;

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);
const { initWebSocket } = require('./utils/websocket');
initWebSocket(server);

// ── Startup: init Neon table → load rows → start listening ───────────────────
async function startup() {
  const start = Date.now();
  logger.info(logger.categories.STARTUP, 'Beginning server startup sequence...');

  if (isMock) {
    logger.warn(
      logger.categories.STARTUP,
      'DATABASE_URL is not set or set to mock. Running with in-memory MockPool database.'
    );
  } else {
    logger.info(logger.categories.DATABASE, 'Connecting to Neon PostgreSQL…');
  }

  try {
    await initDB();
    logger.info(logger.categories.STARTUP, 'Database tables and schemas initialized successfully');
  } catch (dbInitErr) {
    logger.error(logger.categories.STARTUP, `Database initialization failed: ${dbInitErr.message}`, dbInitErr);
    throw dbInitErr;
  }

  // Run migration check automatically at startup
  try {
    const checkRes = await pool.query(
      "SELECT COUNT(*) FROM velan_rows WHERE row_key LIKE '%||%||%||%||%'"
    );
    if (Number(checkRes.rows[0].count) > 0) {
      logger.info(logger.categories.DATABASE, 'Migration needed: Converting old row keys and deduplicating...');
      await runKeyMigration();
      logger.info(logger.categories.DATABASE, 'Migration finished successfully');
    }
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Pre-startup migration check failed: ${err.message}`, err);
  }

  // Load last sync timestamp from logs
  try {
    const syncRes = await pool.query(
      "SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1"
    );
    if (syncRes.rows.length > 0) {
      state._lastSync = new Date(syncRes.rows[0].created_at).toLocaleString('en-IN');
      state._lastSyncTime = new Date(syncRes.rows[0].created_at);
    }
  } catch (err) {
    logger.warn(logger.categories.STARTUP, `Failed to load last sync timestamp: ${err.message}`);
  }

  try {
    await getTotalCount();
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to retrieve total count: ${err.message}`, err);
  }

  // Load live DB rows - fail-safe wrap
  try {
    const liveDb = await loadLiveDB();
    state._liveRows = liveDb;
    logger.info(logger.categories.STARTUP, `Successfully loaded ${liveDb.length} live operational rows from Neon`);
  } catch (err) {
    logger.error(logger.categories.STARTUP, `Failsafe triggered: loadLiveDB failed at startup: ${err.message}. Server starting with empty liveRows.`, err);
    state._liveRows = [];
  }

  logger.info(logger.categories.STARTUP, `Static files path resolved: ${path.resolve(__dirname, '..', '..', 'dist')}`);
  logger.info(logger.categories.STARTUP, `index.html exists: ${fs.existsSync(path.join(path.resolve(__dirname, '..', '..', 'dist'), 'index.html'))}`);

  server.listen(PORT, () => {
    const startupDuration = Date.now() - start;
    logger.info(logger.categories.STARTUP, `Server successfully listening on port ${PORT} (startup took ${startupDuration}ms)`);
    console.log(`\n┌─────────────────────────────────────────────────┐`);
    console.log(`│  Velan Metrology Dashboard — Backend Server     │`);
    console.log(`│  http://localhost:${PORT}                          │`);
    console.log(`│  Data:   http://localhost:${PORT}/api/data          │`);
    console.log(`│  Import: http://localhost:${PORT}/api/import        │`);
    console.log(`│  Reset:  http://localhost:${PORT}/api/reset         │`);
    console.log(`│  Sheets: http://localhost:${PORT}/api/sheets        │`);
    console.log(`│  Health: http://localhost:${PORT}/api/health        │`);
    console.log(`└─────────────────────────────────────────────────┘`);
  });
}

startup().catch((err) => {
  logger.error(logger.categories.STARTUP, `[STARTUP FAILED] ${err.message}`, err);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.warn(logger.categories.STARTUP, `[Server] ${signal} received — closing Neon pool…`);
  try {
    await pool.end();
  } catch (_) {
    // ignore error
  }
  server.close(() => {
    logger.warn(logger.categories.STARTUP, '[Server] Closed. Goodbye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Global Exception/Rejection Handlers ──────────────────────────────────────
process.on('uncaughtException', (err) => {
  try {
    logger.error(logger.categories.STARTUP, `UNCAUGHT EXCEPTION: ${err.message}`, err);
  } catch (_) {
    console.error('UNCAUGHT EXCEPTION:', err);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  try {
    logger.error(logger.categories.STARTUP, `UNHANDLED REJECTION: ${reason}`, reason instanceof Error ? reason : new Error(String(reason)));
  } catch (_) {
    console.error('UNHANDLED REJECTION:', reason);
  }
});
