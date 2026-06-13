const express = require('express');
const router = express.Router();
const state = require('../state');
const { queryRowsPaginated, getTotalCount, loadLiveDB, saveLiveRows, insertRows, logSync, pool } = require('../db/pool');
const { dataUploadSchema } = require('../schemas/upload.schema');
const { validateBody } = require('../middleware/validation');
const { getOrSetCache, invalidatePattern, TTL } = require('../cache/cacheService');
const keys = require('../cache/cacheKeys');
const asyncHandler = require('../utils/asyncHandler');

const { getPaginatedData } = require('../db/queryBuilder');

// ── GET /api/data ─────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '100', 10);
  
  const filters = {
    search: req.query.search || '',
    stage: req.query.stage || '',
    vendor: req.query.vendor || '',
    status: req.query.status || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || ''
  };

  const cacheKey = keys.DASHBOARD_DATA(page, limit, JSON.stringify(filters));
  
  const result = await getOrSetCache(cacheKey, TTL.SHORT, () => getPaginatedData(filters, page, limit));
  
  res.json({
    rows: result.rows,
    liveRows: [], // Kept for backwards compat during migration, now we just use 'rows' where _isLive=true
    lastSync: state._lastSync,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}));

// ── POST /api/data — replace live snapshot AND save new rows to Neon ──────
// NOTE: validateBody expects Express (req, res, next) signature if we updated it,
// but the old `validateBody(schema)(payload, res)` wrote head. Let's fix that.
// The task requires moving validation into Express middlewares or validating inside the controller.
router.post('/', asyncHandler(async (req, res) => {
  let syncType = req.query.sync_type || 'Manual Upload';
  let incomingLength = 0;
  
  try {
    const payload = req.body;
    
    // Zod Validation
    const valResult = dataUploadSchema.safeParse(payload);
    if (!valResult.success) {
      return res.status(400).json({ success: false, error: 'Validation Error', details: valResult.error.errors });
    }
    const validated = valResult.data;

    const incoming = validated.rows;
    incomingLength = incoming.length;

    // 1. Replace the live snapshot table in database
    await saveLiveRows(incoming);
    state._liveRows = incoming;

    // 2. Save/Upsert new rows to velan_rows in Neon
    const saved = await insertRows(incoming);

    const currentTotal = await getTotalCount();
    state._lastSync = new Date().toLocaleString('en-IN');

    // Invalidate caches
    await invalidatePattern('dashboard:*');

    // 3. Log the successful sync
    await logSync(syncType, incomingLength, 'success');

    console.log(`[POST /api/data] Live: ${incoming.length} | DB: ${currentTotal} (+${saved} upserted to Neon)`);

    return res.json({
      success: true,
      liveTotal: incoming.length,
      total: currentTotal,
      newRows: saved,
      lastSync: state._lastSync,
    });
  } catch (err) {
    console.error('[POST /api/data] failed:', err.message);
    await logSync(syncType, incomingLength, 'failed');
    return res.status(400).json({ success: false, error: err.message });
  }
}));

// ── DELETE /api/data — wipe all rows from Neon ────────────────────────────
router.delete('/', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM velan_rows');
  await pool.query('DELETE FROM velan_live_rows');
  state._liveRows = [];
  state._lastSync = '';
  
  // Invalidate caches
  await invalidatePattern('dashboard:*');
  
  console.log('[DELETE /api/data] All rows wiped from Neon DB');
  return res.json({ success: true, message: 'All rows deleted from database.' });
}));

module.exports = router;
