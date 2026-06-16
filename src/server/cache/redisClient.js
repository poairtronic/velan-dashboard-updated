const { Redis } = require('@upstash/redis');
const { env } = require('../config/env');

const isMock = !process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL === 'mock';

let redisClient;

if (!isMock) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('[Redis] Initialized Upstash Redis Client');
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
    async set(key, value, options) {
      // @upstash/redis options can be passed as third argument e.g. { ex: 300 }
      let duration = null;
      if (options && options.ex) {
        duration = options.ex;
      } else if (arguments.length > 3 && arguments[2] === 'EX') {
        duration = arguments[3];
      }

      const expiresAt = duration ? Date.now() + duration * 1000 : null;
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
    async ping() {
      return 'PONG';
    }
  }
  redisClient = new MockRedis();
}

module.exports = redisClient;
