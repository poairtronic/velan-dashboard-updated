const state = require('../state');
const { pool } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const exportQueue = require('../queues/exportQueue');

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
    
    let redis = 'connected';
    try {
      await redisClient.ping();
    } catch (e) {
      redis = 'disconnected: ' + e.message;
    }

    let queueMetrics = {};
    try {
      const counts = await exportQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
      queueMetrics = counts;
    } catch (e) {
      queueMetrics = { error: e.message };
    }

    const uptime = Math.round(process.uptime()) + 's';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        database,
        redis,
        queueMetrics,
        pool: {
          totalCount: pool.totalCount || 0,
          idleCount: pool.idleCount || 0,
          waitingCount: pool.waitingCount || 0
        },
        rows,
        lastSync: state._lastSync || 'never',
        uptime,
      })
    );
  }
}

module.exports = handleHealthRoute;
