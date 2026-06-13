const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const state = require('../state');
const asyncHandler = require('../utils/asyncHandler');
const { invalidatePattern } = require('../cache/cacheService');
const { getTotalCount } = require('../db/pool');

// ── GET /api/sync-status — retrieve sync logs ────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const logsRes = await pool.query(
    'SELECT sync_type, row_count, status, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50'
  );
  return res.json({
    success: true,
    logs: logsRes.rows,
  });
}));

module.exports = router;
