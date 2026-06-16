const express = require('express');
const router = express.Router();
const { exportQueue } = require('../queues/exportQueue');
const redisClient = require('../cache/redisClient');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/reports/generate
router.post('/generate', asyncHandler(async (req, res) => {
  const { type, filters, search } = req.body;

  if (!['pdf', 'csv', 'excel', 'json'].includes(type)) {
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

// GET /api/reports/download/:jobId
router.get('/download/:jobId', asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const fileKey = `export:${jobId}`;

  const rawMeta = await redisClient.get(fileKey);
  if (!rawMeta) {
    return res.status(404).json({ error: 'Report not found or expired. Reports expire after 1 hour.' });
  }

  let fileMeta;
  try {
    fileMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read report data' });
  }

  if (!fileMeta || !fileMeta.base64) {
    return res.status(500).json({ error: 'Report data is corrupt' });
  }

  const buffer = Buffer.from(fileMeta.base64, 'base64');

  let contentType = 'application/octet-stream';
  if (fileMeta.type === 'pdf') {
    contentType = 'application/pdf';
  } else if (fileMeta.type === 'csv') {
    contentType = 'text/csv';
  } else if (fileMeta.type === 'json') {
    contentType = 'application/json';
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileMeta.filename || 'export.' + fileMeta.type}"`);
  return res.send(buffer);
}));

module.exports = router;

