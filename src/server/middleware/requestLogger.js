const morgan = require('morgan');

// Standard Morgan Logger: logs method, path, status, and duration
const requestLogger = morgan((tokens, req, res) => {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens['response-time'](req, res) + 'ms'
  ].join(' ');
});

module.exports = requestLogger;
