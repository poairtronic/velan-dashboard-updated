const express = require('express');
const router = express.Router();
const exportQueue = require('../queues/exportQueue');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/reports/generate
router.post('/generate', asyncHandler(async (req, res) => {
  const { type, filters, search } = req.body;

  if (!['pdf', 'csv', 'excel'].includes(type)) {
    return res.status(400).json({ error: 'Invalid export type' });
  }

  const job = await exportQueue.add('generate-report', { type, filters, search });
  
  return res.status(202).json({ 
    success: true, 
    jobId: job.id, 
    statusUrl: `/api/reports/status/${job.id}` 
  });
}));

// GET /api/reports/status/:jobId
router.get('/status/:jobId', asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const job = await exportQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const isCompleted = await job.isCompleted();
  const isFailed = await job.isFailed();

  if (isCompleted) {
    return res.status(200).json({ status: 'completed', result: job.returnvalue });
  } else if (isFailed) {
    return res.status(200).json({ status: 'failed', error: job.failedReason });
  } else {
    return res.status(200).json({ status: 'processing' });
  }
}));

module.exports = router;
