const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../cache/redisClient');

// We use the same redisClient for rate limiting
// For mock mode, express-rate-limit will fallback to memory if we don't supply the store
// But rate-limit-redis requires an ioredis/redis client object.
// @upstash/redis is REST, so `rate-limit-redis` does not support it out of the box natively.
// WAIT! @upstash/ratelimit is the official way for Upstash. But I installed express-rate-limit and rate-limit-redis.
// Since rate-limit-redis requires a standard Redis client, and Upstash REST client doesn't implement sendCommand,
// I should just use MemoryStore for rate-limit when using Upstash REST, or write a custom store.
// Let's use the built-in memory store of express-rate-limit since it works perfectly for a single instance,
// and it's robust. If the user wants distributed rate limiting later, they can use @upstash/ratelimit.

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 2000, // limit each IP to 2000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = {
  apiLimiter
};
