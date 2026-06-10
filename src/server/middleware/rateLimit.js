const redisClient = require('../cache/redisClient');

function createLimiter(name, maxRequests, windowMs) {
  return async function (req, res) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
    const storeKey = `rate-limit:${name}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove timestamps older than the window
      await redisClient.zremrangebyscore(storeKey, 0, windowStart);
      
      // Get count of remaining active timestamps
      const activeCount = await redisClient.zcard(storeKey);

      if (activeCount >= maxRequests) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(windowMs / 1000),
        });
        res.end(
          JSON.stringify({
            success: false,
            error: `Too Many Requests. Rate limit exceeded for ${name}. Try again later.`,
          })
        );
        return false;
      }

      // Add current timestamp
      await redisClient.zadd(storeKey, now, now);
      // Set expiry on the key to prevent memory leaks
      await redisClient.expire(storeKey, Math.ceil(windowMs / 1000));
      return true;
    } catch (err) {
      console.error('[RateLimit Error]', err.message);
      // Fail open if Redis is down
      return true; 
    }
  };
}

const loginLimiter = createLimiter('login', 5, 15 * 60 * 1000); // 5 requests per 15 minutes
const uploadLimiter = createLimiter('upload', 20, 60 * 60 * 1000); // 20 requests per hour
const adminLimiter = createLimiter('admin', 50, 60 * 60 * 1000); // 50 requests per hour

module.exports = {
  loginLimiter,
  uploadLimiter,
  adminLimiter,
};
