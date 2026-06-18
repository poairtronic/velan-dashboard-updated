const express = require('express');
const router = express.Router();
const { pool, isMock } = require('../db/pool');
const { logAudit } = require('../utils/auditLogger');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/audit/log (Internal/frontend use)
router.post('/log', asyncHandler(async (req, res) => {
  const { action, entityType, entityId, metadata } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  await logAudit({
    req,
    action,
    entityType,
    entityId,
    metadata
  });

  res.json({ success: true });
}));

// GET /api/audit/history (Admin only)
router.get('/history', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const { user, action, fromDate, toDate } = req.query;

  if (isMock) {
    // Perform JS-level filtering for Mock mode
    let logs = pool.auditLogs || [];
    if (user) {
      const uLower = user.toLowerCase();
      logs = logs.filter(l => l.user_email && l.user_email.toLowerCase().includes(uLower));
    }
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    if (fromDate) {
      const fTime = new Date(fromDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= fTime);
    }
    if (toDate) {
      const tTime = new Date(`${toDate} 23:59:59`).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= tTime);
    }
    return res.json({ success: true, logs });
  }

  // Neon PostgreSQL query
  let queryText = 'SELECT id, user_id, user_email, action, entity_type, entity_id, metadata, ip_address, timestamp FROM audit_log WHERE 1=1';
  const queryParams = [];

  if (user) {
    queryParams.push(`%${user}%`);
    queryText += ` AND user_email ILIKE $${queryParams.length}`;
  }
  if (action) {
    queryParams.push(action);
    queryText += ` AND action = $${queryParams.length}`;
  }
  if (fromDate) {
    queryParams.push(fromDate);
    queryText += ` AND timestamp >= $${queryParams.length}`;
  }
  if (toDate) {
    queryParams.push(`${toDate} 23:59:59`);
    queryText += ` AND timestamp <= $${queryParams.length}`;
  }

  queryText += ' ORDER BY timestamp DESC LIMIT 1000';

  const result = await pool.query(queryText, queryParams);
  res.json({
    success: true,
    logs: result.rows
  });
}));

module.exports = router;
