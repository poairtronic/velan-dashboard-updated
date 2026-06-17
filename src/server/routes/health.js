const express = require('express');
const router = express.Router();
const state = require('../state');
const { pool } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');

const { reportQueue } = require('../queues/reportQueue');
const asyncHandler = require('../utils/asyncHandler');
const { getCacheStats } = require('../cache/cacheService');

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

// Sync only health check
router.get('/sync', asyncHandler(async (req, res) => {
  try {
    const logsRes = await pool.query(
      'SELECT sync_type, row_count, status, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50'
    );
    const history = logsRes.rows.slice(0, 10);
    const errorCount = logsRes.rows.filter(row => row.status === 'failed' || row.status === 'error').length;
    res.json({
      status: 'healthy',
      lastSync: state._lastSync || 'never',
      errorCount,
      history
    });
  } catch (e) {
    res.status(500).json({
      status: 'unhealthy',
      error: e.message
    });
  }
}));

module.exports = router;
