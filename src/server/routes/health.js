const express = require('express');
const router = express.Router();
const state = require('../state');
const { pool } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');

const { reportQueue } = require('../queues/reportQueue');
const asyncHandler = require('../utils/asyncHandler');
const { getCacheStats, setRedisAvailable } = require('../cache/cacheService');
const { requireAuth } = require('../middleware/auth');
const { getActiveConnections } = require('../utils/websocket');

// Aggregate health endpoint
router.get('/', asyncHandler(async (req, res) => {
  let database = 'connected';
  let rows = 0;
  try {
    const dbRes = await pool.query('SELECT COUNT(*) FROM velan_rows');
    rows = Number(dbRes.rows[0].count);
  } catch (e) {
    database = 'disconnected: ' + e.message;
  }
  
  let redis = 'connected';
  try {
    await redisClient.ping();
  } catch (e) {
    redis = 'disconnected: ' + e.message;
  }

  let queueMetrics = {};
  try {
    queueMetrics.exportQueue = await exportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    queueMetrics.syncQueue = await syncQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    queueMetrics.reportQueue = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
  } catch (e) {
    queueMetrics = { error: e.message };
  }

  let cacheStats = {};
  try {
    cacheStats = getCacheStats();
  } catch (e) {
    cacheStats = { error: e.message };
  }

  const uptime = Math.round(process.uptime()) + 's';
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: (database === 'connected' && redis === 'connected' && !queueMetrics.error) ? 'healthy' : 'degraded',
    database,
    redis,
    queueMetrics,
    cache: cacheStats,
    pool: {
      totalCount: pool.totalCount || 0,
      idleCount: pool.idleCount || 0,
      waitingCount: pool.waitingCount || 0
    },
    rows,
    lastSync: state._lastSync || 'never',
    uptime,
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
    }
  });
}));

// DB only health check
router.get('/db', asyncHandler(async (req, res) => {
  const start = Date.now();
  try {
    const dbRes = await pool.query('SELECT 1 as ping');
    const responseTime = Date.now() - start;
    if (dbRes.rows[0].ping === 1) {
      return res.json({
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        pool: {
          totalCount: pool.totalCount || 0,
          idleCount: pool.idleCount || 0,
          waitingCount: pool.waitingCount || 0
        }
      });
    }
    throw new Error('Invalid query response');
  } catch (e) {
    res.status(500).json({
      status: 'unhealthy',
      error: e.message
    });
  }
}));

// Redis only health check
router.get('/redis', asyncHandler(async (req, res) => {
  const start = Date.now();
  try {
    const pong = await redisClient.ping();
    const responseTime = Date.now() - start;
    res.json({
      status: 'healthy',
      ping: pong,
      latency: `${responseTime}ms`
    });
  } catch (e) {
    res.status(500).json({
      status: 'unhealthy',
      error: e.message
    });
  }
}));

// Queues only health check
router.get('/queues', asyncHandler(async (req, res) => {
  try {
    const exportWorker = require('../workers/exportWorker');
    const syncWorker = require('../workers/syncWorker');
    const reportWorker = require('../workers/reportWorker');

    const getWorkerStatus = (w) => {
      if (!w) return 'not_initialized';
      if (typeof w.isRunning === 'function') {
        return w.isRunning() ? 'running' : 'stopped';
      }
      return 'running'; // Mock worker default
    };

    const metrics = {
      exportQueue: {
        counts: await exportQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
        workerStatus: getWorkerStatus(exportWorker)
      },
      syncQueue: {
        counts: await syncQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
        workerStatus: getWorkerStatus(syncWorker)
      },

      reportQueue: {
        counts: await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
        workerStatus: getWorkerStatus(reportWorker)
      }
    };

    res.json({
      status: 'healthy',
      queues: metrics
    });
  } catch (e) {
    res.status(500).json({
      status: 'unhealthy',
      error: e.message
    });
  }
}));

// Full health report endpoint
router.get('/full', asyncHandler(async (req, res) => {
  const start = Date.now();
  
  // 1. API status
  const apiStatus = { status: 'healthy', responseTimeMs: 0 };
  
  // 2. Database status
  let dbStatus = { status: 'healthy', connectionCount: 0, avgQueryTimeMs: 0 };
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    dbStatus.avgQueryTimeMs = Date.now() - dbStart;
    dbStatus.connectionCount = pool.totalCount || 0;
  } catch (dbErr) {
    dbStatus.status = 'unhealthy';
    dbStatus.error = dbErr.message;
  }
  
  // 3. Redis status
  let redisStatus = { status: 'healthy', hitRatio: 0, memoryUsedMB: 0 };
  try {
    const stats = getCacheStats();
    redisStatus.status = stats.isRedisAvailable ? 'healthy' : 'unhealthy';
    redisStatus.hitRatio = parseFloat(stats.ratio) || 0;
    
    // Memory usage check (failsafe)
    let memoryUsedMB = 0.5;
    try {
      if (typeof redisClient.info === 'function') {
        const info = await redisClient.info();
        if (typeof info === 'string') {
          const match = info.match(/used_memory:(\d+)/);
          if (match) memoryUsedMB = (parseInt(match[1], 10) / 1024 / 1024).toFixed(2);
        } else if (info && info.memory) {
          memoryUsedMB = (info.memory.used_memory / 1024 / 1024).toFixed(2);
        }
      }
    } catch (_) {}
    redisStatus.memoryUsedMB = parseFloat(memoryUsedMB);
  } catch (redisErr) {
    redisStatus.status = 'unhealthy';
    redisStatus.error = redisErr.message;
  }
  
  // 4. WebSocket status
  const wsStatus = {
    status: 'healthy',
    activeConnections: getActiveConnections()
  };
  
  // 5. Background Jobs status
  let bgStatus = { status: 'healthy', lastRunAt: null, nextRunAt: null, failedCount: 0 };
  try {
    const syncCounts = await syncQueue.getJobCounts('failed');
    const exportCounts = await exportQueue.getJobCounts('failed');
    const reportCounts = await reportQueue.getJobCounts('failed');
    bgStatus.failedCount = (syncCounts.failed || 0) + (exportCounts.failed || 0) + (reportCounts.failed || 0);

    // Get last run time from database logs
    const syncRes = await pool.query("SELECT created_at FROM sync_logs WHERE sync_type = 'Google Sheets Sync' ORDER BY created_at DESC LIMIT 1");
    if (syncRes.rows.length > 0) {
      bgStatus.lastRunAt = syncRes.rows[0].created_at;
      // Estimate next run (5 minutes interval standard)
      bgStatus.nextRunAt = new Date(new Date(bgStatus.lastRunAt).getTime() + 5 * 60 * 1000).toISOString();
    }
  } catch (qErr) {
    bgStatus.status = 'degraded';
    bgStatus.error = qErr.message;
  }
  
  // 6. Google Sheet sync status
  let sheetSyncStatus = { status: 'healthy', lastSyncAt: null, lastSyncRowCount: 0, errorMessage: null };
  try {
    const syncRes = await pool.query(
      'SELECT created_at, row_count, status, error_message FROM sync_logs ORDER BY created_at DESC LIMIT 1'
    );
    if (syncRes.rows.length > 0) {
      const latest = syncRes.rows[0];
      sheetSyncStatus.lastSyncAt = latest.created_at;
      sheetSyncStatus.lastSyncRowCount = latest.row_count;
      sheetSyncStatus.errorMessage = latest.error_message;
      if (latest.status === 'failed' || latest.status === 'error') {
        sheetSyncStatus.status = 'degraded';
      }
    }
  } catch (syncErr) {
    sheetSyncStatus.status = 'degraded';
    sheetSyncStatus.error = syncErr.message;
  }
  
  apiStatus.responseTimeMs = Date.now() - start;
  
  res.json({
    api: apiStatus,
    database: dbStatus,
    redis: redisStatus,
    websocket: wsStatus,
    backgroundJobs: bgStatus,
    googleSheetSync: sheetSyncStatus
  });
}));

// POST /api/health/dr/test (Simulate DR outage and degradation scenarios)
router.post('/dr/test', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const { scenario } = req.body;
  const testedAt = new Date().toISOString();
  
  if (scenario === 'gracefulDegradationTest') {
    try {
      // 1. Check current state and disable Redis
      const stats = getCacheStats();
      const originalAvailable = stats.isRedisAvailable;
      
      setRedisAvailable(false);
      
      // 2. Perform a test calculation run (goes direct to DB without throwing)
      const { calculateKPIs } = require('../services/kpiService');
      const { getFilteredData, computeGroups } = require('../services/dataQueryService');
      
      const todayStr = new Date().toISOString().split('T')[0];
      const filtered = await getFilteredData({}, todayStr);
      const { scGroups, poGroups } = computeGroups(filtered);
      const kpis = calculateKPIs({ filtered, scGroups, poGroups, todayStr });
      
      // 3. Restore original cache state
      setRedisAvailable(originalAvailable);
      
      return res.json({
        scenario,
        passed: true,
        details: `Simulated Redis offline successfully. KPIs fell back to Neon DB and calculated ${kpis.totalItems} items. Redis caching restored.`,
        testedAt
      });
    } catch (err) {
      return res.json({
        scenario,
        passed: false,
        details: `Redis graceful degradation test failed: ${err.message}`,
        testedAt
      });
    }
  }
  
  if (scenario === 'fallbackTest') {
    try {
      // 1. Simulate Google Sheets sync failure
      const { logSync } = require('../db/pool');
      await logSync('Google Sheets Sync (DR Test)', 0, 'failed', 0, 0, 0, 'Simulated Google Sheets API Outage (HTTP 503)');
      
      // 2. Verify we can still query Neon state without crashes
      const countRes = await pool.query('SELECT COUNT(*) FROM velan_live_rows');
      const rowCount = countRes.rows[0] ? parseInt(countRes.rows[0].count, 10) : 0;
      
      return res.json({
        scenario,
        passed: true,
        details: `Simulated Google Sheets sync failure. Logged 'failed' to sync history. Database live state is preserved with ${rowCount} entries. Server is operational.`,
        testedAt
      });
    } catch (err) {
      return res.json({
        scenario,
        passed: false,
        details: `DR fallback test failed: ${err.message}`,
        testedAt
      });
    }
  }
  
  res.status(400).json({ error: 'Unknown DR test scenario' });
}));

module.exports = router;
