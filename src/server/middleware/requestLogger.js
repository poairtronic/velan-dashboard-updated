const crypto = require('crypto');
const logger = require('../utils/logger');
const { env } = require('../config/env');

const requestLogger = (req, res, next) => {
  // Generate or extract Request ID
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  const isProd = (process.env.NODE_ENV === 'production' || (env && env.NODE_ENV === 'production'));

  // Log on request finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      id: requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous',
      userAgent: req.headers['user-agent']
    };

    if (isProd) {
      logger.info(logger.categories.API, `${req.method} ${req.originalUrl || req.url} ${res.statusCode} in ${duration}ms`, logData);
    } else {
      // Clean readable format for development console
      console.log(`[${new Date().toISOString()}] [INFO] [API] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms | ID: ${requestId}`);
    }
  });

  next();
};

module.exports = requestLogger;
