/**
 * 404 Not Found Middleware
 */
// eslint-disable-next-line no-unused-vars
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
};

module.exports = notFound;
