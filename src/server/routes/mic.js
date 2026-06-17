const express = require('express');
const { calculateMIC } = require('../services/micService');
const { getFilteredData, computeGroups } = require('../services/dataQueryService');
const { getOrSetCache } = require('../cache/cacheService');

const router = express.Router();

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = `mic_intelligence:${JSON.stringify(filters)}`;
    
    const micData = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { scGroups, poGroups } = computeGroups(filtered);

      return calculateMIC({ filtered, scGroups, poGroups, todayStr });
    });

    res.json(micData);
  } catch (error) {
    console.error('MIC calculation error:', error);
    res.status(500).json({ error: 'MIC calculation failed', details: error.message });
  }
});

module.exports = router;
