const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { getOrSetCache, TTL } = require('../cache/cacheService');
const keys = require('../cache/cacheKeys');
const {
  getDashboardKPIs,
  getBottlenecks,
  getVendorStats,
  getCycleTimeStats,
  getScGroups,
  getPoGroups,
  getDatabaseKPIs,
  getProductionKPIs,
  getFilterOptions
} = require('../db/queryBuilder');

function extractFilters(req) {
  return {
    search: req.query.search || '',
    stage: req.query.stage || '',
    vendor: req.query.vendor || '',
    status: req.query.status || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || ''
  };
}

// ── GET /api/kpis/summary ─────────────────────────────────────────────────
router.get('/summary', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const cacheKey = `kpi:summary:${JSON.stringify(filters)}`;
  const data = await getOrSetCache(cacheKey, TTL.SHORT, () => getDashboardKPIs(filters));
  res.json(data);
}));

// ── GET /api/kpis/bottlenecks ─────────────────────────────────────────────
router.get('/bottlenecks', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const cacheKey = `kpi:bottlenecks:${JSON.stringify(filters)}`;
  const data = await getOrSetCache(cacheKey, TTL.SHORT, () => getBottlenecks(filters));
  res.json({ bottlenecks: data });
}));

// ── GET /api/kpis/vendors ─────────────────────────────────────────────────
router.get('/vendors', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const cacheKey = `kpi:vendors:${JSON.stringify(filters)}`;
  const data = await getOrSetCache(cacheKey, TTL.SHORT, () => getVendorStats(filters));
  res.json({ vendors: data });
}));

// ── GET /api/kpis/cycle-time ──────────────────────────────────────────────
router.get('/cycle-time', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const cacheKey = `kpi:cycletime:${JSON.stringify(filters)}`;
  const data = await getOrSetCache(cacheKey, TTL.SHORT, () => getCycleTimeStats(filters));
  res.json({ cycleTimeStats: data });
}));

// ── GET /api/kpis/sc-groups ──────────────────────────────────────────────
router.get('/sc-groups', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const data = await getScGroups(filters);
  res.json(data);
}));

// ── GET /api/kpis/po-groups ──────────────────────────────────────────────
router.get('/po-groups', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const data = await getPoGroups(filters);
  res.json(data);
}));

// ── GET /api/kpis/database-stats ──────────────────────────────────────────────
router.get('/database-stats', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const data = await getDatabaseKPIs(filters);
  res.json(data);
}));

// ── GET /api/kpis/production-stats ──────────────────────────────────────────────
router.get('/production-stats', asyncHandler(async (req, res) => {
  const filters = extractFilters(req);
  const data = await getProductionKPIs(filters);
  res.json(data);
}));

// ── GET /api/kpis/charts ──────────────────────────────────────────────────
router.get('/charts', asyncHandler(async (req, res) => {
  // Can combine stats for specific charts if needed
  res.json({ success: true, message: "Use individual endpoints for modular loading" });
}));

// ── GET /api/kpis/filter-options ──────────────────────────────────────────────
router.get('/filter-options', asyncHandler(async (req, res) => {
  const data = await getFilterOptions();
  res.json(data);
}));

module.exports = router;
