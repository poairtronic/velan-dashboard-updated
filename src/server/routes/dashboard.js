const express = require('express');
const { calculateKPIs } = require('../services/kpiService');
const { calculateStages } = require('../services/stageService');
const { calculateCycleTimes } = require('../services/cycleTimeService');
const { calculateVendors } = require('../services/vendorService');
const { calculateBottlenecks } = require('../services/bottleneckService');
const { getFilteredData, computeGroups } = require('../services/dataQueryService');
const keys = require('../cache/cacheKeys');
const { getOrSetCache, TTL } = require('../cache/cacheService');
const { getFreshnessMetadata } = require('./meta');

const router = express.Router();

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/calculations', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = keys.DASHBOARD_OVERVIEW(filters);
    
    const combinedResult = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { scGroups, poGroups } = computeGroups(filtered);

      // 1. Stages
      const stages = calculateStages({ filtered, poGroups, todayStr });
      
      // 2. KPIs
      const kpis = calculateKPIs({ filtered, scGroups, poGroups, todayStr });
      
      // 3. Cycle Times
      const cycleTimes = calculateCycleTimes({ filtered, scGroups });
      
      // 4. Vendors
      const vendors = calculateVendors({ filtered, todayStr });
      
      // 5. Bottlenecks (depends on others)
      const bottlenecks = calculateBottlenecks({
        poGroups,
        todayStr,
        stageCounts: stages.stageCounts,
        stageCycleTimes: cycleTimes.stageCycleTimes,
        vendorStats: vendors.vendorStats,
      });

      return {
        ...kpis,
        ...stages,
        ...bottlenecks,
        ...vendors,
        ...cycleTimes,
      };
    });

    res.json({ ...combinedResult, _meta: getFreshnessMetadata() });
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

// Specific endpoints
router.get('/kpis', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = keys.DASHBOARD_KPIS(filters);
    const result = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { scGroups, poGroups } = computeGroups(filtered);
      return calculateKPIs({ filtered, scGroups, poGroups, todayStr });
    });
    res.json({ ...result, _meta: getFreshnessMetadata() });
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/stages', async (req, res) => {
  try {
    const filters = req.query;
    // We didn't explicitly define DASHBOARD_STAGES in plan, but we can reuse overview or define a new one. 
    // The user didn't ask for a separate stages cache step, but we will just use a generic hash.
    const cacheKey = `dashboard:stages:${keys.DASHBOARD_KPIS(filters).split(':').pop()}`;
    const result = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { poGroups } = computeGroups(filtered);
      return calculateStages({ filtered, poGroups, todayStr });
    });
    res.json({ ...result, _meta: getFreshnessMetadata() });
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/cycle-times', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = keys.DASHBOARD_CYCLE_TIME(filters);
    const result = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { scGroups } = computeGroups(filtered);
      return calculateCycleTimes({ filtered, scGroups });
    });
    res.json({ ...result, _meta: getFreshnessMetadata() });
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/vendors', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = keys.DASHBOARD_VENDORS(filters);
    const result = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      return calculateVendors({ filtered, todayStr });
    });
    res.json({ ...result, _meta: getFreshnessMetadata() });
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

// For Bottlenecks (user requested /api/bottlenecks which doesn't exist yet, but I'll add it)
router.get('/bottlenecks', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = keys.DASHBOARD_BOTTLENECKS(filters);
    const result = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { poGroups, scGroups } = computeGroups(filtered);
      
      const stages = calculateStages({ filtered, poGroups, todayStr });
      const cycleTimes = calculateCycleTimes({ filtered, scGroups });
      const vendors = calculateVendors({ filtered, todayStr });
      
      return calculateBottlenecks({
        poGroups,
        todayStr,
        stageCounts: stages.stageCounts,
        stageCycleTimes: cycleTimes.stageCycleTimes,
        vendorStats: vendors.vendorStats,
      });
    });
    res.json({ ...result, _meta: getFreshnessMetadata() });
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

module.exports = router;
