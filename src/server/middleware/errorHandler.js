/**
 * Global Error Handler Middleware
 */
const logger = require('../utils/logger');
const { env } = require('../config/env');

// Initialize global error counter
global.errorMetrics = global.errorMetrics || { total: 0, byRoute: {} };

const errorHandler = (err, req, res, next) => {
  const isProd = (process.env.NODE_ENV === 'production' || (env && env.NODE_ENV === 'production'));
  const status = err.status || 500;
  
  // Track error counts by route prefix (e.g. /api/auth, /api/data)
  const routePrefix = req.originalUrl ? req.originalUrl.split('?')[0].split('/').slice(0, 3).join('/') : 'unknown';
  
  global.errorMetrics.total++;
  global.errorMetrics.byRoute[routePrefix] = (global.errorMetrics.byRoute[routePrefix] || 0) + 1;

  // Log error using structured logger
  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous',
    requestId: req.id || req.headers['x-request-id'] || 'none',
    status
  };

  if (!isProd) {
    logMeta.stack = err.stack;
  }

  logger.error(logger.categories.API, `[API_ERROR] ${err.name || 'Error'}: ${err.message}`, logMeta);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.errors
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
