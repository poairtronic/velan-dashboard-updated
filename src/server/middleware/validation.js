const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors
        ? err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
        : err.message,
    });
  }
};

const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors
        ? err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
        : err.message,
    });
  }
};

module.exports = {
  validateBody,
  validateQuery
};
