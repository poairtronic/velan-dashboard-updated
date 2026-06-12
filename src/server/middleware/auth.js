const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'velan_secret_default_key_123456';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'velan_refresh_secret_default_key_789012';

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name.trim();
    if (!name) return;
    let value = rest.join('=').trim();
    try {
      value = decodeURIComponent(value);
    } catch (e) {
      // Ignore malformed URI components
    }
    list[name] = value;
  });
  return list;
}

function serializeCookie(name, val, options = {}) {
  let str = `${name}=${encodeURIComponent(val)}`;
  if (options.maxAge != null) {
    str += `; Max-Age=${options.maxAge}`;
  }
  if (options.path) {
    str += `; Path=${options.path}`;
  }
  if (options.httpOnly) {
    str += `; HttpOnly`;
  }
  if (options.secure) {
    str += `; Secure`;
  }
  if (options.sameSite) {
    str += `; SameSite=${options.sameSite}`;
  }
  return str;
}

function authenticate(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.vd_token;
  const refreshToken = cookies.vd_refresh_token;

  // 1. Verify access token
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return true;
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
      const accessCookie = serializeCookie('vd_token', newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 15 * 60, // 15 minutes
      });

      res.setHeader('Set-Cookie', accessCookie);
      req.user = decodedRefresh;
      return true;
    } catch (err) {
      // Refresh token is expired/invalid too
    }
  }

  return false;
}

function requireAuth(req, res, roles = []) {
  // Allow API key fallback
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.API_SECRET && apiKey === process.env.API_SECRET) {
    req.user = { id: 0, username: 'api-user', role: 'admin' };
    return true;
  }

  const authenticated = authenticate(req, res);
  if (!authenticated) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session' }));
    return false;
  }

  if (roles.length > 0 && !roles.includes(req.user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Forbidden: Insufficient permissions' }));
    return false;
  }

  return true;
}

function requireApiKey(req, res) {
  if (!process.env.API_SECRET) return true;
  const key = req.headers['x-api-key'];
  if (key === process.env.API_SECRET) return true;

  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid API Key' }));
  return false;
}

module.exports = {
  parseCookies,
  serializeCookie,
  requireAuth,
  requireApiKey,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
