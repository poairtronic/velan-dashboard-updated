function validateBody(schema) {
  return function(body, res) {
    try {
      const parsed = schema.parse(body);
      return { success: true, data: parsed };
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Validation Error', 
        details: err.errors ? err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) : err.message 
      }));
      return { success: false, error: err };
    }
  };
}

module.exports = {
  validateBody,
};
