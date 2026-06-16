const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

function authenticate(req, res, next) {
  const token = req.cookies?.vd_token;
  const refreshToken = req.cookies?.vd_refresh_token;

  // 1. Verify access token
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // Token expired or invalid, proceed to refresh token validation
    }
  }

  // 2. Verify refresh token
  if (refreshToken) {
    try {
      const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: decodedRefresh.id, username: decodedRefresh.username, role: decodedRefresh.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Set new access token cookie
      res.cookie('vd_token', newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes in ms
      });

      req.user = decodedRefresh;
      return next();
    } catch (err) {
      // Refresh token is expired/invalid too
    }
  }

  // If no valid session, proceed without req.user set
  next();
}

const logger = require('../utils/logger');

function requireAuth(roles = []) {
  return (req, res, next) => {
    // Allow API key fallback
    const apiKey = req.headers['x-api-key'];
    if (apiKey && env.API_SECRET && apiKey === env.API_SECRET) {
      req.user = { id: 0, username: 'api-user', role: 'admin' };
      return next();
    }

    if (!req.user) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
      logger.warn(logger.categories.AUTH, '[AUTH FAILURE] Unauthorized: Invalid or expired session', { ip, url: req.originalUrl });
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
      logger.warn(logger.categories.AUTH, `[AUTH FAILURE] Forbidden: Insufficient permissions for user ${req.user.username}`, {
        ip,
        url: req.originalUrl,
        username: req.user.username,
        role: req.user.role,
        requiredRoles: roles
      });
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}

function requireApiKey(req, res, next) {
  if (!env.API_SECRET) return next();
  const key = req.headers['x-api-key'];
  if (key === env.API_SECRET) return next();

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
  logger.warn(logger.categories.AUTH, '[AUTH FAILURE] Unauthorized: Invalid API Key', { ip, url: req.originalUrl });
  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
}

module.exports = {
  authenticate,
  requireAuth,
  requireApiKey,
};
