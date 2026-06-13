const express = require('express');
const router = express.Router();
const state = require('../state');
const { fetchRemote, parseCSV } = require('../utils/helpers');
const { insertRows, getTotalCount, logSync, pool } = require('../db/pool');
const { importUploadSchema } = require('../schemas/upload.schema');
const { invalidatePattern } = require('../cache/cacheService');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');

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

  const imported = await insertRows(rows);
  const totalCount = await getTotalCount();
  state._lastSync = new Date().toLocaleString('en-IN');

  await invalidatePattern('dashboard:*');
  await logSync('History Import', rows.length, 'success');

  console.log(`[POST /api/reset] Re-imported ${imported} rows | DB now: ${totalCount}`);
  return res.json({
    success: true,
    imported,
    total: totalCount,
    lastSync: state._lastSync,
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

    const imported = await insertRows(incoming);
    const currentTotal = await getTotalCount();
    state._lastSync = new Date().toLocaleString('en-IN');

    await invalidatePattern('dashboard:*');
    await logSync('History Import', incomingLength, 'success');

    console.log(`[POST /api/import] Imported/Updated: ${imported} | DB: ${currentTotal}`);

    return res.json({
      success: true,
      imported,
      skipped: incomingLength - imported,
      total: currentTotal,
      lastSync: state._lastSync,
    });
  } catch (err) {
    console.error('[POST /api/import] failed:', err.message);
    await logSync('History Import', incomingLength, 'failed');
    return res.status(400).json({ success: false, error: err.message });
  }
}));

module.exports = router;
