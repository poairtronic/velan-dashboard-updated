const express = require('express');
const { calculateKPIs } = require('../services/kpiService');
const { calculateStages } = require('../services/stageService');
const { calculateCycleTimes } = require('../services/cycleTimeService');
const { calculateVendors } = require('../services/vendorService');
const { calculateBottlenecks } = require('../services/bottleneckService');
const { getFilteredData, computeGroups } = require('../services/dataQueryService');

const router = express.Router();

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/calculations', async (req, res) => {
  try {
    const todayStr = getTodayStr();
    const filters = req.query;

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

    const combinedResult = {
      ...kpis,
      ...stages,
      ...bottlenecks,
      ...vendors,
      ...cycleTimes,
    };

    res.json(combinedResult);
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

// Specific endpoints
router.get('/kpis', async (req, res) => {
  try {
    const todayStr = getTodayStr();
    const filtered = await getFilteredData(req.query, todayStr);
    const { scGroups, poGroups } = computeGroups(filtered);
    res.json(calculateKPIs({ filtered, scGroups, poGroups, todayStr }));
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/stages', async (req, res) => {
  try {
    const todayStr = getTodayStr();
    const filtered = await getFilteredData(req.query, todayStr);
    const { poGroups } = computeGroups(filtered);
    res.json(calculateStages({ filtered, poGroups, todayStr }));
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/cycle-times', async (req, res) => {
  try {
    const todayStr = getTodayStr();
    const filtered = await getFilteredData(req.query, todayStr);
    const { scGroups } = computeGroups(filtered);
    res.json(calculateCycleTimes({ filtered, scGroups }));
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

router.get('/vendors', async (req, res) => {
  try {
    const todayStr = getTodayStr();
    const filtered = await getFilteredData(req.query, todayStr);
    res.json(calculateVendors({ filtered, todayStr }));
  } catch (error) {
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

module.exports = router;
