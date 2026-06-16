const redisClient = require('./redisClient');

/**
 * Cache strategies and duration (in seconds)
 */
const TTL = {
  SHORT: 5 * 60, // 5 minutes (Dashboard metrics, Reports)
  MEDIUM: 15 * 60, // 15 minutes (Analytics)
  LONG: 30 * 60, // 30 minutes (Users)
  EXTRA_LONG: 60 * 60, // 1 Hour (Settings)
};

const stats = {
  hits: 0,
  misses: 0,
  errors: 0
};

function getCacheStats() {
  const total = stats.hits + stats.misses;
  const ratio = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : '0.00';
  return { ...stats, ratio: `${ratio}%` };
}

/**
 * Generic Cache Wrapper
 * Checks cache first, if not found, executes fetchFn and caches result.
 */
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  try {
    const start = Date.now();
    const cachedData = await redisClient.get(key);
    
    // Upstash returns objects if they were stringified sometimes, but let's be safe
    if (cachedData) {
      stats.hits++;
      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      // Add latency tracking if desired, but we'll just return for now
      return parsed;
    }
    
    stats.misses++;
    const freshData = await fetchFn();
    await redisClient.set(key, JSON.stringify(freshData), { ex: ttlSeconds });
    return freshData;
  } catch (err) {
    stats.errors++;
    console.error(`[Cache Error] on key ${key}:`, err.message);
    // Fallback to fetchFn if Redis fails
    return await fetchFn();
  }
}

/**
 * Invalidate a specific key
 */
async function invalidateCache(key) {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error(`[Cache Invalidation Error] on key ${key}:`, err.message);
  }
}

/**
 * Invalidate keys by pattern (e.g. invalidate all paginated dashboard data)
 */
async function invalidatePattern(pattern) {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    console.error(`[Cache Invalidation Error] on pattern ${pattern}:`, err.message);
  }
}

/**
 * Hard flush (Use carefully)
 */
async function flushCache() {
  try {
    await redisClient.flushdb();
  } catch (err) {
    console.error(`[Cache Flush Error]:`, err.message);
  }
}

module.exports = {
  TTL,
  getOrSetCache,
  invalidateCache,
  invalidatePattern,
  flushCache,
  getCacheStats
};
