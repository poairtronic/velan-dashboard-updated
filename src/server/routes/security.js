const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    apiSecretEnabled: !!env.API_SECRET,
    corsRestricted: !!env.ALLOWED_ORIGIN,
    sheetsWhitelistEnabled: true,
    rateLimitingEnabled: true,
  });
}));

module.exports = router;
