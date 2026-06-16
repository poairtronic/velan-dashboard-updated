const express = require('express');
const { getCacheStats } = require('../cache/cacheService');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');
const { emailQueue } = require('../queues/emailQueue');
const { reportQueue } = require('../queues/reportQueue');

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
    const emailCounts = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const reportCounts = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    
    res.json({
      success: true,
      queues: {
        exportQueue: exportCounts,
        syncQueue: syncCounts,
        emailQueue: emailCounts,
        reportQueue: reportCounts
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve job counts: ' + err.message });
  }
});

module.exports = router;

