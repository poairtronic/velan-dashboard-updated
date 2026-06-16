const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { broadcast } = require('../utils/websocket');

const router = express.Router();

// GET /api/alerts - retrieve notifications
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  
  let queryText = 'SELECT id, rule_key, severity, category, message, item_key, status, resolved_at, created_at FROM alerts';
  const queryParams = [];

  if (status === 'unread' || status === 'read') {
    queryText += ' WHERE status = $1';
    queryParams.push(status);
  }

  queryText += ' ORDER BY created_at DESC LIMIT 100';

  const result = await pool.query(queryText, queryParams);
  
  res.json({
    success: true,
    alerts: result.rows
  });
}));

// PUT /api/alerts/read - mark alerts as read
router.put('/read', asyncHandler(async (req, res) => {
  const { ids, all } = req.body;

  let result;
  if (all === true) {
    result = await pool.query(
      "UPDATE alerts SET status = 'read', resolved_at = NOW() WHERE status = 'unread' RETURNING id"
    );
  } else if (Array.isArray(ids) && ids.length > 0) {
    result = await pool.query(
      "UPDATE alerts SET status = 'read', resolved_at = NOW() WHERE id = ANY($1) RETURNING id",
      [ids]
    );
  } else {
    return res.status(400).json({ success: false, error: 'Invalid parameters. Provide ids array or all=true' });
  }

  // Broadcast WebSocket alert update so clients know they were cleared
  broadcast('alerts:read_updated', { ids: result.rows.map(r => r.id), all: all === true });

  res.json({
    success: true,
    updatedCount: result.rowCount
  });
}));

// GET /api/alerts/rules - retrieve configurations (admin only)
router.get('/rules', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, rule_key, rule_name, category, severity, threshold_value, enabled, recipients FROM alert_rules ORDER BY id'
  );
  res.json({
    success: true,
    rules: result.rows
  });
}));

// PUT /api/alerts/rules - update thresholds and configurations (admin only)
router.put('/rules', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ success: false, error: 'Provide rules array in body' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const rule of rules) {
      const { rule_key, threshold_value, enabled, recipients } = rule;
      if (!rule_key) continue;

      await client.query(
        `UPDATE alert_rules 
         SET threshold_value = COALESCE($1, threshold_value),
             enabled = COALESCE($2, enabled),
             recipients = COALESCE($3, recipients)
         WHERE rule_key = $4`,
        [threshold_value, enabled, recipients, rule_key]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Broadcast that rules have changed
  broadcast('alert_rules:changed', {});

  res.json({
    success: true,
    message: 'Alert rules updated successfully'
  });
}));

module.exports = router;
