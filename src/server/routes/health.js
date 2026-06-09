const state = require('../state');
const { pool } = require('../db/pool');

async function handleHealthRoute(req, res, pathname) {
  if (pathname === '/api/health') {
    let database = 'connected';
    let rows = 0;
    try {
      const dbRes = await pool.query('SELECT COUNT(*) FROM velan_rows');
      rows = Number(dbRes.rows[0].count);
    } catch (e) {
      database = 'disconnected: ' + e.message;
    }
    const uptime = Math.round(process.uptime()) + 's';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        database,
        rows,
        lastSync: state._lastSync || 'never',
        uptime,
      })
    );
  }
}

module.exports = handleHealthRoute;
