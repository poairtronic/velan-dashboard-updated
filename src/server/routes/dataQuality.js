const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const ALLOWED_STAGES = new Set([
  'LATHE', 'M1', 'FB', 'HT', 'SZ', 'BLK', 'CG', 'SG', 'SD', 'HO', 'CA', 'WC', 'VA', 'QC', 'DCPLI',
  'FBV', 'BLV', 'SDV', 'HOV', 'HTV', 'HCV', 'RM', 'READY', 'STORES', 'STOCK', 'EXSTOCK',
  'BLACKENING', 'PLACING', 'BRAZING', 'PLATING', 'CALIBRATION'
]);

// Helper: Run Data Quality scan
async function runScan() {
  // 1. Fetch all live snapshot rows
  const dbRes = await pool.query('SELECT id, row_key, data FROM velan_live_rows');
  const rows = dbRes.rows.map(r => ({
    dbId: r.id,
    rowKey: r.row_key,
    ...r.data
  }));

  const detectedIssues = []; // array of { issue_type, affected_row_id, affected_field }
  
  // Track SC occurrences for duplicate detection
  const scMap = {};
  // Track PO info for duplicate/conflict detection
  const poMap = {};

  const now = new Date();
  const cutoff2020 = new Date('2020-01-01');

  rows.forEach(row => {
    const rowId = row.rowKey || String(row.dbId);

    // 1. Missing PO number
    if (!row.po || String(row.po).trim() === '') {
      detectedIssues.push({
        issue_type: 'MISSING_PO',
        affected_row_id: rowId,
        affected_field: 'po'
      });
    } else {
      const poNum = String(row.po).trim();
      if (!poMap[poNum]) {
        poMap[poNum] = [];
      }
      poMap[poNum].push(row);
    }

    // 2. Missing vendor name (if VENDOR inhouse)
    if (row.inhouse === 'VENDOR') {
      const vendorName = row.vendor || row.currentStage;
      if (!vendorName || String(vendorName).trim() === '' || String(vendorName).toUpperCase() === 'UNKNOWN') {
        detectedIssues.push({
          issue_type: 'MISSING_VENDOR',
          affected_row_id: rowId,
          affected_field: 'vendor'
        });
      }
    }

    // 3. Invalid/unknown stage value
    if (row.currentStage && String(row.currentStage).trim() !== '') {
      const stageUp = String(row.currentStage).trim().toUpperCase();
      if (!ALLOWED_STAGES.has(stageUp) && !stageUp.endsWith('V')) { // Allow custom vendor codes e.g. SDV, HTV
        detectedIssues.push({
          issue_type: 'INVALID_STAGE',
          affected_row_id: rowId,
          affected_field: 'currentStage'
        });
      }
    }

    // Accumulate SC for duplicates
    if (row.sc && String(row.sc).trim() !== '') {
      const scNum = String(row.sc).trim();
      if (!scMap[scNum]) {
        scMap[scNum] = [];
      }
      scMap[scNum].push(rowId);
    }

    // 4. Bad dates
    // Dates validation
    if (row.poDate) {
      const pDate = new Date(row.poDate);
      if (isNaN(pDate.getTime())) {
        detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'poDate' });
      } else {
        if (pDate > now) {
          detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'poDate' });
        }
        if (pDate < cutoff2020) {
          detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'poDate' });
        }
      }
    }

    if (row.timestamp) {
      const tDate = new Date(row.timestamp);
      if (isNaN(tDate.getTime())) {
        detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'timestamp' });
      } else {
        if (tDate > now) {
          detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'timestamp' });
        }
        if (tDate < cutoff2020) {
          detectedIssues.push({ issue_type: 'BAD_DATE', affected_row_id: rowId, affected_field: 'timestamp' });
        }
      }
    }

    if (row.poDate && row.timestamp) {
      const pDate = new Date(row.poDate);
      const tDate = new Date(row.timestamp);
      if (!isNaN(pDate.getTime()) && !isNaN(tDate.getTime()) && pDate > tDate) {
        detectedIssues.push({
          issue_type: 'BAD_DATE',
          affected_row_id: rowId,
          affected_field: 'poDate_timestamp_conflict'
        });
      }
    }
  });

  // Duplicate SC numbers detection
  Object.entries(scMap).forEach(([scNum, rowIds]) => {
    if (rowIds.length > 1) {
      rowIds.forEach(rowId => {
        detectedIssues.push({
          issue_type: 'DUPLICATE_SC',
          affected_row_id: rowId,
          affected_field: 'sc'
        });
      });
    }
  });

  // Duplicate POs with conflicting data
  Object.entries(poMap).forEach(([poNum, poRows]) => {
    if (poRows.length > 1) {
      // Check for conflicts: e.g. different poDates or different inhouse type
      const poDates = [...new Set(poRows.map(r => r.poDate).filter(Boolean))];
      const vendors = [...new Set(poRows.map(r => r.vendor || r.currentStage).filter(Boolean))];
      
      if (poDates.length > 1 || vendors.length > 1) {
        poRows.forEach(row => {
          const rowId = row.rowKey || String(row.dbId);
          detectedIssues.push({
            issue_type: 'DUPLICATE_PO_CONFLICT',
            affected_row_id: rowId,
            affected_field: 'po'
          });
        });
      }
    }
  });

  // Write new scan results to the database and resolve fixed ones
  const activeUnresolved = await pool.query('SELECT id, issue_type, affected_row_id FROM data_quality_issues WHERE resolved_at IS NULL');
  const unresolvedMap = new Map();
  activeUnresolved.rows.forEach(r => {
    unresolvedMap.set(`${r.issue_type}||${r.affected_row_id}`, r.id);
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert new issues that aren't already flagged as unresolved
    const currentKeys = new Set();
    for (const issue of detectedIssues) {
      const key = `${issue.issue_type}||${issue.affected_row_id}`;
      currentKeys.add(key);

      if (!unresolvedMap.has(key)) {
        await client.query(
          `INSERT INTO data_quality_issues (issue_type, affected_row_id, affected_field, detected_at)
           VALUES ($1, $2, $3, NOW())`,
          [issue.issue_type, issue.affected_row_id, issue.affected_field]
        );
      }
    }

    // 2. Auto-resolve issues that are no longer detected in the current scan
    for (const [key, id] of unresolvedMap.entries()) {
      if (!currentKeys.has(key)) {
        await client.query(
          'UPDATE data_quality_issues SET resolved_at = NOW() WHERE id = $1',
          [id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return detectedIssues.length;
}

// GET /api/data-quality/issues - Retrieve all open issues
router.get('/issues', requireAuth(), asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, issue_type, affected_row_id, affected_field, detected_at FROM data_quality_issues WHERE resolved_at IS NULL ORDER BY detected_at DESC'
  );
  
  // Optionally enrich issues with raw row data so front-end has context
  const liveRowsRes = await pool.query('SELECT row_key, data FROM velan_live_rows');
  const liveRowsMap = new Map(liveRowsRes.rows.map(r => [r.row_key, r.data]));
  
  const enrichedIssues = result.rows.map(issue => {
    const rawData = liveRowsMap.get(issue.affected_row_id) || {};
    return {
      ...issue,
      details: {
        sc: rawData.sc || '',
        po: rawData.po || '',
        product: rawData.product || '',
        currentStage: rawData.currentStage || '',
        inhouse: rawData.inhouse || '',
        poDate: rawData.poDate || '',
        timestamp: rawData.timestamp || ''
      }
    };
  });

  res.json({
    success: true,
    issues: enrichedIssues
  });
}));

// POST /api/data-quality/scan - Trigger a scan
router.post('/scan', requireAuth(), asyncHandler(async (req, res) => {
  const count = await runScan();
  res.json({
    success: true,
    message: 'Data quality scan completed.',
    issueCount: count
  });
}));

// POST /api/data-quality/resolve/:id - Manually resolve an issue
router.post('/resolve/:id', requireAuth(), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid issue ID' });

  const result = await pool.query(
    'UPDATE data_quality_issues SET resolved_at = NOW() WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Issue not found or already resolved' });
  }

  res.json({
    success: true,
    message: 'Issue marked as resolved'
  });
}));

module.exports = {
  router,
  runScan
};
