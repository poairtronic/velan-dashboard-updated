/**
 * Async Handler Wrapper
 * Wraps async route handlers to pass errors to the global error handler
 * without needing try/catch in every route.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
