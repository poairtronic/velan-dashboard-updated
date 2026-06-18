const express = require('express');
const router = express.Router();
const state = require('../state');
const { queryRowsPaginated, getTotalCount, loadLiveDB, saveLiveRows, insertRows, logSync, pool } = require('../db/pool');
const { dataUploadSchema } = require('../schemas/upload.schema');
const { validateBody } = require('../middleware/validation');
const { getOrSetCache, invalidatePattern, TTL } = require('../cache/cacheService');
const keys = require('../cache/cacheKeys');
const asyncHandler = require('../utils/asyncHandler');

const { getFilteredData, computeGroups } = require('../services/dataQueryService');

// ── GET /api/data/production ────────────────────────────────────────────────
router.get('/production', asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '100', 10);
    const offset = (page - 1) * limit;

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const filtered = await getFilteredData(req.query, todayStr);
    
    // Additional data for frontend modal or quick access
    const { allScItemsModal, filteredScGroupsModal } = (() => {
      const allSc = {};
      const filtSc = {};
      // To build allScItemsModal properly we actually need the un-filtered merged data
      // For performance in pagination, we skip returning it unless requested, 
      // but if the frontend needs it, we build it.
      return { allScItemsModal: {}, filteredScGroupsModal: {} };
    })();

    const paginatedRows = filtered.slice(offset, offset + limit);

    res.json({
      rows: paginatedRows,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit)
    });
  } catch (error) {
    console.error('[GET /api/data/production] failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch production data' });
  }
}));

// ── GET /api/data ─────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '500', 10);
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  const cacheKey = keys.DASHBOARD_DATA(page, limit, search);
  const dbRows = await getOrSetCache(cacheKey, TTL.SHORT, () => queryRowsPaginated({ limit, offset, search }));
  
  const liveDbRows = await getOrSetCache(keys.DASHBOARD_LIVE, TTL.SHORT, () => loadLiveDB());
  const total = await getOrSetCache(keys.DASHBOARD_STATS, TTL.SHORT, () => getTotalCount());
  
  res.json({
    rows: dbRows,
    liveRows: liveDbRows.length > 0 ? liveDbRows : dbRows,
    lastSync: state._lastSync,
    total: total,
    page,
    limit
  });
}));

const { syncQueue, QueueEvents } = require('../queues/syncQueue');
const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' };

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

    const syncQueueEvents = new QueueEvents('syncQueue', { connection });
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      action: syncType === 'Google Sheets Sync' ? 'SYNC_TRIGGER' : 'DATA_UPLOAD',
      entityType: 'data',
      metadata: { rowCount: incoming.length, syncType }
    });

    const job = await syncQueue.add('sync-data', { incoming, syncType });
    const result = await job.waitUntilFinished(syncQueueEvents);

    console.log(`[POST /api/data] Live: ${incoming.length} | DB: ${result.total} (+${result.newRows} upserted to Neon)`);

    return res.json({
      success: true,
      liveTotal: result.liveTotal,
      total: result.total,
      newRows: result.newRows,
      lastSync: result.lastSync,
    });
  } catch (err) {
    console.error('[POST /api/data] failed:', err.message);
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
