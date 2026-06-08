const state = require('../state');
const { requireApiKey, readBody } = require('../utils/helpers');
const { loadDB, loadLiveDB, saveLiveRows, insertRows, logSync, pool } = require('../db/pool');

async function handleDataRoutes(req, res, pathname, method, parsed) {
  // ── GET /api/data ─────────────────────────────────────────────────────────
  if (pathname === '/api/data' && method === 'GET') {
    try {
      const dbRows = await loadDB();
      const liveDbRows = await loadLiveDB();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        rows:     dbRows,
        liveRows: liveDbRows.length > 0 ? liveDbRows : dbRows,
        lastSync: state._lastSync,
        total:    dbRows.length,
      }));
    } catch (err) {
      console.error('[GET /api/data] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/data — replace live snapshot AND save new rows to Neon ──────
  if (pathname === '/api/data' && method === 'POST') {
    if (!requireApiKey(req, res)) return;
    let syncType = 'Manual Upload';
    let incomingLength = 0;
    try {
      const body     = await readBody(req);
      const payload  = JSON.parse(body);
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];
      incomingLength = incoming.length;

      // Extract sync_type query parameter if present
      const queryType = parsed.searchParams.get('sync_type');
      if (queryType) {
        syncType = queryType;
      }

      // 1. Replace the live snapshot table in database
      await saveLiveRows(incoming);
      state._liveRows = incoming;

      // 2. Save/Upsert new rows to velan_rows in Neon
      const saved = await insertRows(incoming);
      
      state._db = await loadDB();
      state._lastSync = new Date().toLocaleString('en-IN');

      // 3. Log the successful sync
      await logSync(syncType, incomingLength, 'success');

      console.log(`[POST /api/data] Live: ${incoming.length} | DB: ${state._db.length} (+${saved} upserted to Neon)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success:   true,
        liveTotal: incoming.length,
        total:     state._db.length,
        newRows:   saved,
        lastSync:  state._lastSync,
      }));
    } catch (err) {
      console.error('[POST /api/data] failed:', err.message);
      await logSync(syncType, incomingLength, 'failed');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── DELETE /api/data — wipe all rows from Neon ────────────────────────────
  if (pathname === '/api/data' && method === 'DELETE') {
    if (!requireApiKey(req, res)) return;
    try {
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
      state._db       = [];
      state._liveRows = [];
      state._lastSync = '';
      console.log('[DELETE /api/data] All rows wiped from Neon DB');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'All rows deleted from database.' }));
    } catch (err) {
      console.error('[DELETE /api/data]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── GET /api/sync-status — retrieve sync logs ────────────────────────────
  if (pathname === '/api/sync-status' && method === 'GET') {
    try {
      const logsRes = await pool.query('SELECT sync_type, row_count, status, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        logs: logsRes.rows,
      }));
    } catch (err) {
      console.error('[GET /api/sync-status] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/migrate — fix legacy rows missing currentStage ────────────
  if (pathname === '/api/migrate' && method === 'POST') {
    if (!requireApiKey(req, res)) return;
    try {
      const allRes = await pool.query('SELECT id, row_key, data FROM velan_rows');
      let fixed = 0;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const row of allRes.rows) {
          const d = row.data;
          let changed = false;
          if (!d.currentStage || d.currentStage === '') {
            const stage = d.op || d.OP || '';
            if (stage) {
              d.currentStage = String(stage).trim();
              changed = true;
            }
          }
          if (changed) {
            const newKey = `${d.sc||''}||${d.po||''}||${d.product||''}||${d.currentStage||''}`;
            await client.query(
              'UPDATE velan_rows SET data = $1, row_key = $2 WHERE id = $3',
              [JSON.stringify(d), newKey, row.id]
            );
            fixed++;
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      state._db = await loadDB();
      console.log(`[POST /api/migrate] Fixed ${fixed} rows | DB now: ${state._db.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, fixed, total: state._db.length }));
    } catch (err) {
      console.error('[POST /api/migrate]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
}

module.exports = handleDataRoutes;
