const LIVE_URL = process.env.LIVE_URL || process.env.SHEETS_URL || '';
const HISTORY_URL = process.env.HISTORY_URL || '';

async function handleConfigRoutes(req, res, pathname) {
  // ── GET /api/config — send env URLs to frontend ──────────────────────────
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        liveUrl: LIVE_URL || null,
        historyUrl: HISTORY_URL || null,
      })
    );
  }

  // ── GET /api/security-status — retrieve security status ──────────────────
  if (pathname === '/api/security-status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        apiSecretEnabled: !!process.env.API_SECRET,
        corsRestricted: !!process.env.ALLOWED_ORIGIN,
        sheetsWhitelistEnabled: true,
        rateLimitingEnabled: true,
      })
    );
  }
}

module.exports = handleConfigRoutes;
