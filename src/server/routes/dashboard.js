const express = require('express');
const { calculateKPIs } = require('../services/kpiService');
const { calculateStages } = require('../services/stageService');
const { calculateCycleTimes } = require('../services/cycleTimeService');
const { calculateVendors } = require('../services/vendorService');
const { calculateBottlenecks } = require('../services/bottleneckService');

const router = express.Router();

router.post('/calculations', (req, res) => {
  try {
    const { filtered = [], scGroups = [], poGroups = [], todayStr } = req.body;

    if (!todayStr) {
      return res.status(400).json({ error: 'Missing todayStr' });
    }

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

    // Combine exactly as the frontend useKPIs hook returned
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

// We can also expose individual endpoints if needed, but since they depend on each other,
// and the frontend expects a single object, one endpoint is more efficient.
router.post('/kpis', (req, res) => {
  const { filtered = [], scGroups = [], poGroups = [], todayStr } = req.body;
  res.json(calculateKPIs({ filtered, scGroups, poGroups, todayStr }));
});

router.post('/stages', (req, res) => {
  const { filtered = [], poGroups = [], todayStr } = req.body;
  res.json(calculateStages({ filtered, poGroups, todayStr }));
});

router.post('/cycle-times', (req, res) => {
  const { filtered = [], scGroups = [] } = req.body;
  res.json(calculateCycleTimes({ filtered, scGroups }));
});

router.post('/vendors', (req, res) => {
  const { filtered = [], todayStr } = req.body;
  res.json(calculateVendors({ filtered, todayStr }));
});

module.exports = router;
