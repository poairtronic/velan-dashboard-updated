const express = require('express');
const { pool } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/timeline - retrieve operational log events
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, event_type, title, description, item_key, meta_data, created_at FROM operational_timeline ORDER BY created_at DESC LIMIT 100'
  );
  
  res.json({
    success: true,
    events: result.rows
  });
}));

module.exports = router;
