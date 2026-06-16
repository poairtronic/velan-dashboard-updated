const express = require('express');
const { getCacheStats } = require('../cache/cacheService');

const router = express.Router();

router.get('/cache-stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve cache stats' });
  }
});

module.exports = router;
