const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const state = require('../state');
const asyncHandler = require('../utils/asyncHandler');

// ── GET /api/sync-status — retrieve sync logs ────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const logsRes = await pool.query(
    'SELECT sync_type, row_count, status, duration_ms, rows_updated, rows_skipped, error_message, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50'
  );
  
  const logs = logsRes.rows;
  const errorCount = logs.filter(l => l.status === 'failed' || l.status === 'error').length;
  
  return res.json({
    success: true,
    logs,
    summary: {
      lastSync: state._lastSync || 'never',
      recentErrorsCount: errorCount,
      totalCount: logs.length
    }
  });
}));

module.exports = router;
