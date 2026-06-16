const { env } = require('../config/env');

const levels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

const categories = {
  AUTH: 'AUTH',
  IMPORT: 'IMPORT',
  SYNC: 'SYNC',
  EXPORT: 'EXPORT',
  API: 'API',
  QUEUE: 'QUEUE',
  DATABASE: 'DATABASE',
  REDIS: 'REDIS',
  STARTUP: 'STARTUP',
  SECURITY: 'SECURITY'
};

function formatError(err) {
  if (!err) return null;
  return {
    message: err.message,
    stack: err.stack,
    code: err.code,
    ...err
  };
}

function log(level, category, message, meta = {}) {
  const timestamp = new Date().toISOString();
  
  // Format metadata, especially if it contains an Error object
  let formattedMeta = {};
  if (meta instanceof Error) {
    formattedMeta = { error: formatError(meta) };
  } else if (meta && typeof meta === 'object') {
    formattedMeta = { ...meta };
    for (const key of Object.keys(formattedMeta)) {
      if (formattedMeta[key] instanceof Error) {
        formattedMeta[key] = formatError(formattedMeta[key]);
      }
    }
  } else if (meta !== undefined) {
    formattedMeta = { value: meta };
  }

  const isProd = (process.env.NODE_ENV === 'production' || (env && env.NODE_ENV === 'production'));

  if (isProd) {
    // Structured JSON logging
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      meta: Object.keys(formattedMeta).length > 0 ? formattedMeta : undefined
    };
    if (level === levels.ERROR) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  } else {
    // Readable format for development
    const metaStr = Object.keys(formattedMeta).length > 0 ? ` | ${JSON.stringify(formattedMeta)}` : '';
    const output = `[${timestamp}] [${level}] [${category}] ${message}${metaStr}`;
    if (level === levels.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

const logger = {
  debug: (category, message, meta) => log(levels.DEBUG, category, message, meta),
  info: (category, message, meta) => log(levels.INFO, category, message, meta),
  warn: (category, message, meta) => log(levels.WARN, category, message, meta),
  error: (category, message, meta) => log(levels.ERROR, category, message, meta),
  categories
};

module.exports = logger;
