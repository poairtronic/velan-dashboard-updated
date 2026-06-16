const express = require('express');
const router = express.Router();
const state = require('../state');
const { pool } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');
const { emailQueue } = require('../queues/emailQueue');
const { reportQueue } = require('../queues/reportQueue');
const asyncHandler = require('../utils/asyncHandler');

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
    queueMetrics.emailQueue = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    queueMetrics.reportQueue = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
  } catch (e) {
    queueMetrics = { error: e.message };
  }


  const uptime = Math.round(process.uptime()) + 's';
  
  res.json({
    database,
    redis,
    queueMetrics,
    pool: {
      totalCount: pool.totalCount || 0,
      idleCount: pool.idleCount || 0,
      waitingCount: pool.waitingCount || 0
    },
    rows,
    lastSync: state._lastSync || 'never',
    uptime,
  });
}));

module.exports = router;
