const express = require('express');
const router = express.Router();
const { validateSheetsUrl, getSheetData } = require('../utils/helpers');
const { sheetsQuerySchema } = require('../schemas/dashboard.schema');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');

router.get('/', asyncHandler(async (req, res) => {
  const sheetUrl = req.query.url || env.LIVE_URL;
  if (!sheetUrl) {
    return res.status(400).json({
      error: 'No sheet URL provided. Pass ?url=<url> or set LIVE_URL env var.',
      hint: 'Publish to web → Entire Document → CSV → copy the /pub?output=csv link',
    });
  }

  // Validate target URL using Zod schema
  try {
    sheetsQuerySchema.parse({ url: sheetUrl });
  } catch (err) {
    return res.status(400).json({
      error: 'Validation failed: Invalid Google Sheets URL format.',
      details: err.errors ? err.errors.map((e) => e.message) : err.message,
    });
  }

  // Validate target URL to prevent SSRF (extra layer of check)
  if (!validateSheetsUrl(sheetUrl)) {
    return res.status(403).json({
      error: 'Forbidden: Host is not whitelisted. Only Google Sheets URLs are permitted.',
      hint: 'Enter a valid URL from docs.google.com or docs.googleusercontent.com',
    });
  }

  try {
    const result = await getSheetData(sheetUrl);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Cache': result.cached ? `HIT age=${result.age}s` : 'MISS',
      'X-Source-URL': sheetUrl.substring(0, 80),
    });
    return res.send(result.data);
  } catch (err) {
    console.error('[/api/sheets] fetch error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch Google Sheet.',
      detail: err.message,
      hint: 'File → Share → Publish to web → Entire Document → CSV',
    });
  }
}));

module.exports = router;
