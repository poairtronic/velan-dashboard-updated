const express = require('express');
const router = express.Router();
const { pool, isMock } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

// GET /api/perf/report - returns p50/p95/p99 and cache ratio per endpoint
router.get('/report', requireAuth(['admin']), asyncHandler(async (req, res) => {
  let rows = [];

  if (isMock) {
    rows = pool.perfLogs || [];
  } else {
    // We check if perf_log table exists, if not we handle it gracefully
    try {
      const dbRes = await pool.query(
        'SELECT endpoint, cache_hit, db_query_time_ms, total_response_time_ms FROM perf_log ORDER BY recorded_at DESC LIMIT 5000'
      );
      rows = dbRes.rows;
    } catch (err) {
      if (err.code === '42P01') {
        // Table perf_log does not exist
        rows = [];
      } else {
        throw err;
      }
    }
  }

  const endpointsMap = {};
  rows.forEach(r => {
    const epName = r.endpoint;
    if (!endpointsMap[epName]) {
      endpointsMap[epName] = {
        endpoint: epName,
        totalResponses: [],
        dbQueries: [],
        cacheHits: 0,
        totalCount: 0
      };
    }
    const ep = endpointsMap[epName];
    ep.totalResponses.push(Number(r.total_response_time_ms));
    ep.dbQueries.push(Number(r.db_query_time_ms));
    if (r.cache_hit === true || r.cache_hit === 'true' || r.cache_hit === 1) {
      ep.cacheHits++;
    }
    ep.totalCount++;
  });

  // If no logs, return some default placeholders so the dashboard displays structure
  const endpoints = Object.keys(endpointsMap);
  if (endpoints.length === 0) {
    const defaults = [
      { endpoint: '/api/overview', count: 0, p50: 0, p95: 0, p99: 0, avgDbTime: 0, cacheHitRatio: 0 },
      { endpoint: '/api/manufacturing-intelligence', count: 0, p50: 0, p95: 0, p99: 0, avgDbTime: 0, cacheHitRatio: 0 },
      { endpoint: '/api/executive/war-room', count: 0, p50: 0, p95: 0, p99: 0, avgDbTime: 0, cacheHitRatio: 0 },
      { endpoint: '/api/drilldown/*', count: 0, p50: 0, p95: 0, p99: 0, avgDbTime: 0, cacheHitRatio: 0 }
    ];
    return res.json({ success: true, report: defaults });
  }

  const report = Object.values(endpointsMap).map(ep => {
    return {
      endpoint: ep.endpoint,
      count: ep.totalCount,
      p50: getPercentile(ep.totalResponses, 50),
      p95: getPercentile(ep.totalResponses, 95),
      p99: getPercentile(ep.totalResponses, 99),
      avgDbTime: ep.dbQueries.length > 0 ? Math.round(ep.dbQueries.reduce((a, b) => a + b, 0) / ep.dbQueries.length) : 0,
      cacheHitRatio: ep.totalCount > 0 ? parseFloat(((ep.cacheHits / ep.totalCount) * 100).toFixed(2)) : 0
    };
  });

  res.json({
    success: true,
    report
  });
}));

module.exports = router;
