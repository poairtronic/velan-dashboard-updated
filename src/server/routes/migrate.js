const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { invalidatePattern } = require('../cache/cacheService');
const { getTotalCount } = require('../db/pool');

// ── POST /api/migrate — fix legacy rows missing currentStage ────────────
router.post('/', asyncHandler(async (req, res) => {
  const allRes = await pool.query('SELECT id, row_key, data FROM velan_rows');
  let fixed = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of allRes.rows) {
      const d = row.data;
      let changed = false;
      if (!d.currentStage || d.currentStage === '') {
        const stage = d.op || d.OP || '';
        if (stage) {
          d.currentStage = String(stage).trim();
          changed = true;
        }
      }
      if (changed) {
        const newKey = `${d.sc || ''}||${d.po || ''}||${d.product || ''}||${d.currentStage || ''}`;
        await client.query('UPDATE velan_rows SET data = $1, row_key = $2 WHERE id = $3', [
          JSON.stringify(d),
          newKey,
          row.id,
        ]);
        fixed++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const newTotal = await getTotalCount();
  
  // Invalidate caches
  await invalidatePattern('dashboard:*');
  
  console.log(`[POST /api/migrate] Fixed ${fixed} rows | DB now: ${newTotal}`);
  return res.json({ success: true, fixed, total: newTotal });
}));

module.exports = router;
