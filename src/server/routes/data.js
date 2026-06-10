const state = require('../state');
const { readBody } = require('../utils/helpers');
const { queryRowsPaginated, getTotalCount, loadLiveDB, saveLiveRows, insertRows, logSync, pool } = require('../db/pool');
const { dataUploadSchema } = require('../schemas/upload.schema');
const { validateBody } = require('../middleware/validation');
const { getOrSetCache, invalidatePattern, TTL } = require('../cache/cacheService');
const keys = require('../cache/cacheKeys');

async function handleDataRoutes(req, res, pathname, method, parsed) {
  // ── GET /api/data ─────────────────────────────────────────────────────────
  if (pathname === '/api/data' && method === 'GET') {
    try {
      const page = parseInt(parsed.searchParams.get('page') || '1', 10);
      const limit = parseInt(parsed.searchParams.get('limit') || '500', 10);
      const search = parsed.searchParams.get('search') || '';
      const offset = (page - 1) * limit;

      const cacheKey = keys.DASHBOARD_DATA(page, limit, search);
      const dbRows = await getOrSetCache(cacheKey, TTL.SHORT, () => queryRowsPaginated({ limit, offset, search }));
      
      const liveDbRows = await getOrSetCache(keys.DASHBOARD_LIVE, TTL.SHORT, () => loadLiveDB());
      const total = await getOrSetCache(keys.DASHBOARD_STATS, TTL.SHORT, () => getTotalCount());
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          rows: dbRows,
          liveRows: liveDbRows.length > 0 ? liveDbRows : dbRows,
          lastSync: state._lastSync,
          total: total,
          page,
          limit
        })
      );
    } catch (err) {
      console.error('[GET /api/data] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/data — replace live snapshot AND save new rows to Neon ──────
  if (pathname === '/api/data' && method === 'POST') {
    let syncType = 'Manual Upload';
    let incomingLength = 0;
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);

      // Validate body using Zod schema
      const valResult = validateBody(dataUploadSchema)(payload, res);
      if (!valResult.success) return;
      const validated = valResult.data;

      const incoming = validated.rows;
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

      const currentTotal = await getTotalCount();
      state._lastSync = new Date().toLocaleString('en-IN');

      // Invalidate caches
      await invalidatePattern('dashboard:*');

      // 3. Log the successful sync
      await logSync(syncType, incomingLength, 'success');

      console.log(
        `[POST /api/data] Live: ${incoming.length} | DB: ${currentTotal} (+${saved} upserted to Neon)`
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          success: true,
          liveTotal: incoming.length,
          total: currentTotal,
          newRows: saved,
          lastSync: state._lastSync,
        })
      );
    } catch (err) {
      console.error('[POST /api/data] failed:', err.message);
      await logSync(syncType, incomingLength, 'failed');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── DELETE /api/data — wipe all rows from Neon ────────────────────────────
  if (pathname === '/api/data' && method === 'DELETE') {
    try {
      await pool.query('DELETE FROM velan_rows');
      await pool.query('DELETE FROM velan_live_rows');
      state._liveRows = [];
      state._lastSync = '';
      
      // Invalidate caches
      await invalidatePattern('dashboard:*');
      
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
      const logsRes = await pool.query(
        'SELECT sync_type, row_count, status, created_at FROM sync_logs ORDER BY created_at DESC LIMIT 50'
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          success: true,
          logs: logsRes.rows,
        })
      );
    } catch (err) {
      console.error('[GET /api/sync-status] failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ── POST /api/migrate — fix legacy rows missing currentStage ────────────
  if (pathname === '/api/migrate' && method === 'POST') {
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
            const newKey = `${d.sc || ''}||${d.po || ''}||${d.product || ''}||${d.currentStage || ''}`;
            await client.query('UPDATE velan_rows SET data = $1, row_key = $2 WHERE id = $3', [
              JSON.stringify(d),
              newKey,
              row.id,
            ]);
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
      const newTotal = await getTotalCount();
      
      // Invalidate caches
      await invalidatePattern('dashboard:*');
      
      console.log(`[POST /api/migrate] Fixed ${fixed} rows | DB now: ${newTotal}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, fixed, total: newTotal }));
    } catch (err) {
      console.error('[POST /api/migrate]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
}

module.exports = handleDataRoutes;
