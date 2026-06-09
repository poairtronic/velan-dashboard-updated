const rateLimitStore = new Map();

function createLimiter(name, maxRequests, windowMs) {
  return function(req, res) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
    const storeKey = `${name}:${ip}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(storeKey)) {
      rateLimitStore.set(storeKey, []);
    }
    
    const timestamps = rateLimitStore.get(storeKey);
    const activeTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    if (activeTimestamps.length >= maxRequests) {
      const oldestActive = activeTimestamps[0];
      const msLeft = windowMs - (now - oldestActive);
      const retryAfterSeconds = Math.max(1, Math.ceil(msLeft / 1000));
      
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': retryAfterSeconds
      });
      res.end(JSON.stringify({ 
        success: false, 
        error: `Too Many Requests. Rate limit exceeded for ${name}. Try again in ${retryAfterSeconds} seconds.` 
      }));
      return false;
    }
    
    activeTimestamps.push(now);
    rateLimitStore.set(storeKey, activeTimestamps);
    return true;
  };
}

const loginLimiter = createLimiter('login', 5, 15 * 60 * 1000);   // 5 requests per 15 minutes
const uploadLimiter = createLimiter('upload', 20, 60 * 60 * 1000); // 20 requests per hour
const adminLimiter = createLimiter('admin', 50, 60 * 60 * 1000);   // 50 requests per hour

module.exports = {
  loginLimiter,
  uploadLimiter,
  adminLimiter,
};
