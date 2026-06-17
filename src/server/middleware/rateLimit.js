const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: 'Too many auth requests.' },
  standardHeaders: true,
  legacyHeaders: false
});

const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, error: 'Too many sync requests.' },
  standardHeaders: true,
  legacyHeaders: false
});

const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  message: { success: false, error: 'Too many dashboard requests.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  syncLimiter,
  dashboardLimiter
};
