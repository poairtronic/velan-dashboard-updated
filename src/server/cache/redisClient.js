const Redis = require('ioredis');

// Connect to Redis instance or fallback to mock
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let redisClient;

if (!isMock) {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection Error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
} else {
  // Mock Redis Client for local/testing without a Redis server
  class MockRedis {
    constructor() {
      this.store = new Map();
      console.log('[Redis] Running in Mock Mode');
    }
    async get(key) {
      const item = this.store.get(key);
      if (!item) return null;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.store.delete(key);
        return null;
      }
      return item.value;
    }
    async set(key, value, mode, duration) {
      const expiresAt = mode === 'EX' && duration ? Date.now() + duration * 1000 : null;
      this.store.set(key, { value, expiresAt });
      return 'OK';
    }
    async del(...keys) {
      let count = 0;
      for (const key of keys) {
        if (this.store.has(key)) {
          this.store.delete(key);
          count++;
        }
      }
      return count;
    }
    async keys(pattern) {
      // Basic mock implementation for wildcard matching (e.g. "prefix:*")
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(this.store.keys()).filter((k) => regex.test(k));
    }
    async flushdb() {
      this.store.clear();
      return 'OK';
    }
  }
  redisClient = new MockRedis();
}

module.exports = redisClient;
