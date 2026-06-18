/**
 * Forecast API Routes
 * Thin router wrapping isolated forecast engine modules.
 * All computation is delegated to /src/server/forecast/ utilities.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getAllRawData } = require('../services/dataQueryService');

// Forecast engines
const { calculateSLAForecast } = require('../forecast/slaEngine');
const { calculateCapacityForecast } = require('../forecast/capacityPlanner');
const { calculateQueueForecast } = require('../forecast/queueForecast');
const { calculateVendorRiskForecast } = require('../forecast/vendorRisk');
const { calculateBottleneckForecast } = require('../forecast/bottleneckDetection');
const { calculatePlantRisk } = require('../forecast/plantRisk');

// Helper: get normalized live + db rows
async function getForecastData() {
  const { liveRows, dbRows } = await getAllRawData();
  // Normalize: ensure currentStage is populated
  const normLive = liveRows.map(r => ({
    ...r,
    currentStage: r.currentStage || r.op || r.OP || ''
  }));
  const normDb = dbRows.map(r => ({
    ...r,
    currentStage: r.currentStage || r.op || r.OP || ''
  }));
  return { liveRows: normLive, dbRows: normDb };
}

// GET /api/forecast/sla
router.get('/sla', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateSLAForecast(data);
    res.json(result);
  } catch (error) {
    console.error('[Forecast SLA Error]', error);
    res.status(500).json({ error: 'SLA forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/capacity
router.get('/capacity', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateCapacityForecast(data);
    res.json(result);
  } catch (error) {
    console.error('[Forecast Capacity Error]', error);
    res.status(500).json({ error: 'Capacity forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/queue/:stage
router.get('/queue/:stage', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateQueueForecast({ ...data, stage: req.params.stage });
    res.json(result);
  } catch (error) {
    console.error('[Forecast Queue Error]', error);
    res.status(500).json({ error: 'Queue forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/queue (all stages)
router.get('/queue', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateQueueForecast({ ...data, stage: null });
    res.json(result);
  } catch (error) {
    console.error('[Forecast Queue Error]', error);
    res.status(500).json({ error: 'Queue forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/vendor-risk
router.get('/vendor-risk', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateVendorRiskForecast(data);
    res.json(result);
  } catch (error) {
    console.error('[Forecast Vendor Risk Error]', error);
    res.status(500).json({ error: 'Vendor risk forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/bottleneck
router.get('/bottleneck', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculateBottleneckForecast(data);
    res.json(result);
  } catch (error) {
    console.error('[Forecast Bottleneck Error]', error);
    res.status(500).json({ error: 'Bottleneck forecast calculation failed', details: error.message });
  }
});

// GET /api/forecast/plant-risk (Section 4 + Section 5)
router.get('/plant-risk', requireAuth(), async (req, res) => {
  try {
    const data = await getForecastData();
    const result = await calculatePlantRisk(data);
    res.json(result);
  } catch (error) {
    console.error('[Forecast Plant Risk Error]', error);
    res.status(500).json({ error: 'Plant risk calculation failed', details: error.message });
  }
});

module.exports = router;
