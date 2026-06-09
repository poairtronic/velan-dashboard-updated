const state = require('../state');
const { readBody, fetchRemote, parseCSV } = require('../utils/helpers');
const { insertRows, saveLiveRows, loadDB, logSync, pool } = require('../db/pool');
const { importUploadSchema } = require('../schemas/upload.schema');
const { validateBody } = require('../middleware/validation');

const HISTORY_URL = process.env.HISTORY_URL || '';

async function handleImportRoutes(req, res, pathname, method) {
  // ── POST /api/reset — wipe Neon + optionally re-import from HISTORY_URL ──
  if (pathname === '/api/reset' && method === 'POST') {
    try {
      // 1. Wipe Neon
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
      state._db       = [];
      state._liveRows = [];
      state._lastSync = '';
      console.log('[POST /api/reset] Neon DB wiped');

      // 2. Re-import from HISTORY_URL env var (if set)
      const histUrl = HISTORY_URL;
      if (!histUrl) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'DB wiped. No HISTORY_URL set — nothing imported.', total: 0 }));
      }

      console.log('[POST /api/reset] Fetching fresh data from HISTORY_URL…');
      const raw  = await fetchRemote(histUrl);
      const rows = parseCSV(raw);

      const imported = await insertRows(rows);
      state._db       = await loadDB();
      state._lastSync = new Date().toLocaleString('en-IN');

      await logSync('History Import', rows.length, 'success');

      console.log(`[POST /api/reset] Re-imported ${imported} rows | DB now: ${state._db.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, imported, total: state._db.length, lastSync: state._lastSync }));
    } catch (err) {
      console.error('[POST /api/reset]', err.message);
      await logSync('History Import', 0, 'failed');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/import — append to Neon DB with dedup ──────────────────────
  if (pathname === '/api/import' && method === 'POST') {
    let incomingLength = 0;
    try {
      const body    = await readBody(req);
      const payload = JSON.parse(body);

      // Validate body using Zod schema
      const valResult = validateBody(importUploadSchema)(payload, res);
      if (!valResult.success) return;
      const validated = valResult.data;

      let incoming = [];

      // Support two modes:
      // 1. { rows: [...] }         — caller sends pre-parsed rows
      // 2. { url: '...', replace: true/false } — fetch CSV from URL
      if (Array.isArray(validated.rows) && validated.rows.length > 0) {
        incoming = validated.rows;
      } else if (typeof validated.url === 'string' && validated.url.trim()) {
        console.log(`[POST /api/import] Fetching CSV from URL: ${validated.url.substring(0, 80)}…`);
        const raw = await fetchRemote(validated.url.trim());
        incoming  = parseCSV(raw);
        console.log(`[POST /api/import] Parsed ${incoming.length} rows from CSV`);
      }
      incomingLength = incoming.length;

      // If replace=true, wipe Neon first
      if (validated.replace === true) {
        await pool.query('DELETE FROM velan_rows');
        await pool.query('DELETE FROM velan_live_rows');
        state._db       = [];
        state._liveRows = [];
        console.log('[POST /api/import] replace=true → wiped existing Neon rows');
      }

      const imported = await insertRows(incoming);
      state._db = await loadDB();
      state._lastSync = new Date().toLocaleString('en-IN');

      await logSync('History Import', incomingLength, 'success');

      console.log(`[POST /api/import] Imported/Updated: ${imported} | DB: ${state._db.length}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:  true,
        imported,
        skipped:  incomingLength - imported,
        total:    state._db.length,
        lastSync: state._lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/import] failed:', err.message);
      await logSync('History Import', incomingLength, 'failed');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
}

module.exports = handleImportRoutes;

