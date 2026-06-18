const express = require('express');
const router = express.Router();
const state = require('../state');
const asyncHandler = require('../utils/asyncHandler');

function getFreshnessMetadata() {
  const now = new Date();
  const lastSyncTime = state._lastSyncTime ? state._lastSyncTime.toISOString() : null;
  const freshnessSeconds = state._lastSyncTime ? Math.floor((now.getTime() - state._lastSyncTime.getTime()) / 1000) : null;
  
  let confidenceScore = 100;
  if (freshnessSeconds !== null) {
    if (freshnessSeconds > 1800) { // 30 minutes
      const minutesPast30 = (freshnessSeconds - 1800) / 60;
      confidenceScore = Math.max(60, 100 - minutesPast30);
    }
  }
  
  return {
    lastSyncTime,
    lastCalculationTime: now.toISOString(),
    freshnessSeconds,
    confidenceScore: parseFloat(confidenceScore.toFixed(1))
  };
}

// GET /api/meta/freshness
router.get('/freshness', asyncHandler(async (req, res) => {
  const meta = getFreshnessMetadata();
  res.json({
    success: true,
    googleSheets: meta,
    database: {
      ...meta,
      // Database has same freshness as it is synced simultaneously
    }
  });
}));

module.exports = {
  router,
  getFreshnessMetadata
};
