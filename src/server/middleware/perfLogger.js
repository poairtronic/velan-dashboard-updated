const perfLocalStorage = require('../utils/perfContext');
const { pool } = require('../db/pool');

// Overload pool.query to intercept and log database execution times
const originalQuery = pool.query;
pool.query = async function (sql, params) {
  const store = perfLocalStorage.getStore();
  if (!store) {
    return originalQuery.apply(this, arguments);
  }

  const start = Date.now();
  try {
    return await originalQuery.apply(this, arguments);
  } finally {
    const elapsed = Date.now() - start;
    store.dbQueryTime += elapsed;
  }
};

function perfLogger(req, res, next) {
  const url = req.originalUrl || req.url;

  // Verify if endpoint is a tracking target
  const isTarget = 
    url.startsWith('/api/dashboard/calculations') ||
    url.startsWith('/api/intelligence') ||
    url.startsWith('/api/executive/war-room') ||
    url.startsWith('/api/drilldown');

  if (!isTarget) {
    return next();
  }

  const store = { dbQueryTime: 0, cacheHit: false };
  const startTime = Date.now();

  perfLocalStorage.run(store, () => {
    res.on('finish', async () => {
      const totalTime = Date.now() - startTime;
      
      try {
        let endpoint = url.split('?')[0];
        
        // Map paths to match requirement routes
        if (endpoint === '/api/dashboard/calculations') {
          endpoint = '/api/overview';
        } else if (endpoint === '/api/intelligence') {
          endpoint = '/api/manufacturing-intelligence';
        }

        // Save entry to database performance log
        await originalQuery.call(
          pool,
          `INSERT INTO perf_log (endpoint, cache_hit, db_query_time_ms, total_response_time_ms)
           VALUES ($1, $2, $3, $4)`,
          [endpoint, store.cacheHit, store.dbQueryTime, totalTime]
        );
      } catch (err) {
        console.error('[perfLogger] Failed to write performance trace:', err.message);
      }
    });

    next();
  });
}

module.exports = perfLogger;
