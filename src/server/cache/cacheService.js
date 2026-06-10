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

/**
 * Generic Cache Wrapper
 * Checks cache first, if not found, executes fetchFn and caches result.
 */
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    const freshData = await fetchFn();
    await redisClient.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
    return freshData;
  } catch (err) {
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
  flushCache
};
