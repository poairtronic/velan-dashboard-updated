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

  // Broadcast critical system errors to connected clients (allowed under Popup Rules)
  try {
    const { broadcast } = require('../utils/websocket');
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('database') || msg.includes('postgres') || msg.includes('pool') || msg.includes('connection to db') || msg.includes('relation "') || msg.includes('query')) {
      broadcast('system:error', { type: 'DATABASE_FAILURE', message: 'Database connection or operation failure.' });
    } else if (msg.includes('redis') || msg.includes('ioredis') || msg.includes('upstash')) {
      broadcast('system:error', { type: 'REDIS_FAILURE', message: 'Cache server connection failure.' });
    } else if (msg.includes('bull') || msg.includes('queue') || msg.includes('worker') || msg.includes('job')) {
      broadcast('system:error', { type: 'BULLMQ_FAILURE', message: 'Background queue operation failure.' });
    } else if (status === 500) {
      broadcast('system:error', { type: 'CRITICAL_SYSTEM_ERROR', message: err.message || 'A critical server error occurred.' });
    }
  } catch (wsErr) {
    logger.error(logger.categories.API, `Failed to broadcast system error over WS: ${wsErr.message}`, wsErr);
  }

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
