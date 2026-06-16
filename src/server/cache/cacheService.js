const redisClient = require('./redisClient');
const logger = require('../utils/logger');

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

// Track Redis availability state
let isRedisAvailable = true;
let lastRedisCheck = 0;
const REDIS_RETRY_INTERVAL = 30000; // 30 seconds

async function checkRedisAvailability() {
  const now = Date.now();
  if (!isRedisAvailable && now - lastRedisCheck > REDIS_RETRY_INTERVAL) {
    try {
      await redisClient.ping();
      isRedisAvailable = true;
      logger.info(logger.categories.REDIS, 'Redis connection restored, caching re-enabled');
    } catch (err) {
      lastRedisCheck = now;
    }
  }
  return isRedisAvailable;
}

function handleRedisError(err, contextMsg) {
  if (isRedisAvailable) {
    isRedisAvailable = false;
    lastRedisCheck = Date.now();
    logger.error(logger.categories.REDIS, `Redis went offline: ${contextMsg}. Degrading gracefully to db-only mode.`, err);
  } else {
    logger.debug(logger.categories.REDIS, `Redis offline: ${contextMsg}`, err);
  }
}

function getCacheStats() {
  const total = stats.hits + stats.misses;
  const ratio = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : '0.00';
  return { ...stats, ratio: `${ratio}%`, isRedisAvailable };
}

/**
 * Generic Cache Wrapper
 * Checks cache first, if not found, executes fetchFn and caches result.
 */
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  const redisAvailable = await checkRedisAvailability();
  
  if (!redisAvailable) {
    stats.misses++;
    return await fetchFn();
  }

  try {
    const cachedData = await redisClient.get(key);
    
    // Upstash returns objects if they were stringified sometimes, but let's be safe
    if (cachedData) {
      stats.hits++;
      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return parsed;
    }
    
    stats.misses++;
    const freshData = await fetchFn();
    try {
      await redisClient.set(key, JSON.stringify(freshData), { ex: ttlSeconds });
    } catch (setErr) {
      handleRedisError(setErr, `set key ${key}`);
    }
    return freshData;
  } catch (err) {
    stats.errors++;
    handleRedisError(err, `get key ${key}`);
    // Fallback to fetchFn if Redis fails
    return await fetchFn();
  }
}

/**
 * Invalidate a specific key
 */
async function invalidateCache(key) {
  const redisAvailable = await checkRedisAvailability();
  if (!redisAvailable) return;
  
  try {
    await redisClient.del(key);
  } catch (err) {
    handleRedisError(err, `delete key ${key}`);
  }
}

/**
 * Invalidate keys by pattern (e.g. invalidate all paginated dashboard data)
 */
async function invalidatePattern(pattern) {
  const redisAvailable = await checkRedisAvailability();
  if (!redisAvailable) return;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    handleRedisError(err, `invalidate pattern ${pattern}`);
  }
}

/**
 * Hard flush (Use carefully)
 */
async function flushCache() {
  const redisAvailable = await checkRedisAvailability();
  if (!redisAvailable) return;

  try {
    await redisClient.flushdb();
  } catch (err) {
    handleRedisError(err, 'flush cache');
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
