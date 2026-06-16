const express = require('express');
const router = express.Router();
const state = require('../state');
const { fetchRemote, parseCSV } = require('../utils/helpers');
const { getTotalCount, pool } = require('../db/pool');
const { importUploadSchema } = require('../schemas/upload.schema');
const { invalidatePattern } = require('../cache/cacheService');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');
const { syncQueue, QueueEvents } = require('../queues/syncQueue');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

// ── POST /api/reset — wipe Neon + optionally re-import from HISTORY_URL ──
router.post('/reset', asyncHandler(async (req, res) => {
  // 1. Wipe Neon
  await pool.query('DELETE FROM velan_rows');
  await pool.query('DELETE FROM velan_live_rows');
  state._liveRows = [];
  state._lastSync = '';
  
  await invalidatePattern('dashboard:*');
  console.log('[POST /api/reset] Neon DB wiped');

  // 2. Re-import from HISTORY_URL env var (if set)
  const histUrl = env.HISTORY_URL;
  if (!histUrl) {
    return res.json({
      success: true,
      message: 'DB wiped. No HISTORY_URL set — nothing imported.',
      total: 0,
    });
  }

  console.log('[POST /api/reset] Fetching fresh data from HISTORY_URL…');
  const raw = await fetchRemote(histUrl);
  const rows = parseCSV(raw);

  const syncQueueEvents = new QueueEvents('syncQueue', { connection });
  const job = await syncQueue.add('sync-reset', { incoming: rows, syncType: 'History Import' });
  const result = await job.waitUntilFinished(syncQueueEvents);

  console.log(`[POST /api/reset] Re-imported ${result.newRows} rows | DB now: ${result.total}`);
  return res.json({
    success: true,
    imported: result.newRows,
    total: result.total,
    lastSync: result.lastSync,
  });
}));

// ── POST /api/import — append to Neon DB with dedup ──────────────────────
router.post('/import', asyncHandler(async (req, res) => {
  let incomingLength = 0;
  try {
    const payload = req.body;

    // Validate body using Zod schema
    const valResult = importUploadSchema.safeParse(payload);
    if (!valResult.success) {
      return res.status(400).json({ success: false, error: 'Validation Error', details: valResult.error.errors });
    }
    const validated = valResult.data;

    let incoming = [];

    // Support two modes:
    if (Array.isArray(validated.rows) && validated.rows.length > 0) {
      incoming = validated.rows;
    } else if (typeof validated.url === 'string' && validated.url.trim()) {
      console.log(`[POST /api/import] Fetching CSV from URL: ${validated.url.substring(0, 80)}…`);
      const raw = await fetchRemote(validated.url.trim());
      incoming = parseCSV(raw);
      console.log(`[POST /api/import] Parsed ${incoming.length} rows from CSV`);
    }
    incomingLength = incoming.length;

    // If replace=true, wipe Neon first
    if (validated.replace === true) {
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
      state._liveRows = [];
      console.log('[POST /api/import] replace=true → wiped existing Neon rows');
    }

    const syncQueueEvents = new QueueEvents('syncQueue', { connection });
    const job = await syncQueue.add('sync-import', { incoming, syncType: 'History Import' });
    const result = await job.waitUntilFinished(syncQueueEvents);

    console.log(`[POST /api/import] Imported/Updated: ${result.newRows} | DB: ${result.total}`);

    return res.json({
      success: true,
      imported: result.newRows,
      skipped: incomingLength - result.newRows,
      total: result.total,
      lastSync: result.lastSync,
    });
  } catch (err) {
    console.error('[POST /api/import] failed:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
}));

module.exports = router;

