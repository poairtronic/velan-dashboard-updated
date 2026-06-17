const express = require('express');
const { getCacheStats } = require('../cache/cacheService');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');
const { reportQueue } = require('../queues/reportQueue');
const { pool } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const state = require('../state');

const router = express.Router();

router.get('/cache-stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve cache stats' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const exportCounts = await exportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const syncCounts = await syncQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const reportCounts = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    
    res.json({
      success: true,
      queues: {
        exportQueue: exportCounts,
        syncQueue: syncCounts,
        reportQueue: reportCounts
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve job counts: ' + err.message });
  }
});

router.get('/ops', async (req, res) => {
  try {
    // 1. Database Pool Stats
    const dbStats = {
      totalCount: pool.totalCount || 0,
      idleCount: pool.idleCount || 0,
      waitingCount: pool.waitingCount || 0,
    };

    // 2. Redis status and Cache metrics
    let redisStatus = 'connected';
    try {
      await redisClient.ping();
    } catch (_) {
      redisStatus = 'disconnected';
    }
    const cacheStats = getCacheStats();

    // 3. Queue job counts
    const exportCounts = await exportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const syncCounts = await syncQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const reportCounts = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');

    // 4. Last sync info
    let lastSyncLog = null;
    try {
      const logsRes = await pool.query(
        'SELECT sync_type, row_count, status, duration_ms, rows_updated, rows_skipped, error_message, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 1'
      );
      if (logsRes.rows.length > 0) {
        lastSyncLog = logsRes.rows[0];
      }
    } catch (_) {}

    // 5. Memory and Uptime
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    // 6. Error metrics
    const errorMetrics = global.errorMetrics || { total: 0, byRoute: {} };

    res.json({
      success: true,
      data: {
        server: {
          uptime: `${Math.round(uptime)}s`,
          memory: {
            rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`
          }
        },
        database: {
          pool: dbStats
        },
        redis: {
          status: redisStatus,
          cache: cacheStats
        },
        queues: {
          exportQueue: exportCounts,
          syncQueue: syncCounts,
          reportQueue: reportCounts
        },
        lastSync: lastSyncLog || {
          time: state._lastSync || 'never',
          status: 'unknown'
        },
        errors: errorMetrics
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve operational metrics: ' + err.message });
  }
});

module.exports = router;
