/**
 * Velan Metrology Dashboard — Backend Server Orchestrator
 * ──────────────────────────────────────────────────────
 * Refactored modular entry point.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const { pool, isMock, initDB, runKeyMigration, loadDB, loadLiveDB } = require('./db/pool');
const state = require('./state');
const { validateSheetsUrl, readBody } = require('./utils/helpers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// Security Middlewares and Schemas
const {
  requireAuth,
  requireApiKey,
  serializeCookie,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
} = require('./middleware/auth');
const { loginLimiter, uploadLimiter, adminLimiter } = require('./middleware/rateLimit');
const { validateBody } = require('./middleware/validation');
const { loginSchema, registerSchema } = require('./schemas/auth.schema');
const { adminCreateSchema, updateStatusSchema } = require('./schemas/user.schema');

// Routes
const handleDataRoutes = require('./routes/data');
const handleImportRoutes = require('./routes/import');
const handleSheetsRoutes = require('./routes/sheets');
const handleHealthRoute = require('./routes/health');
const handleConfigRoutes = require('./routes/config');

const PORT = process.env.PORT || 10000;
const LIVE_URL = process.env.LIVE_URL || process.env.SHEETS_URL || '';
const HISTORY_URL = process.env.HISTORY_URL || '';

// Fallback Credentials (only if env is not defined)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const USER_USER = process.env.USER_USER || 'user';
const USER_PASS = process.env.USER_PASS || 'user123';

// ── HTTP Server ───────────────────────────────────────────────────────────────
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  let parsed;
  try {
    parsed = new URL(req.url, `http://localhost`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }
  const pathname = parsed.pathname;

  // ── Apply Security Headers ────────────────────────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.logrocket.io https://cdn.logrocket.com https://cdn.logr-in.com https://cdn.lr-in.com https://cdn.lr-in-est.com https://cdn.lr-ingest.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' https://docs.google.com https://docs.googleusercontent.com https://*.logrocket.io https://*.logrocket.com https://*.logr-in.com https://*.lr-in.com https://*.lr-in-est.com https://*.lr-ingest.com; " +
      "img-src 'self' data:; " +
      "frame-ancestors 'none';"
  );

  // ── CORS headers with Credentials support ─────────────────────────────────
  const origin = req.headers.origin || '';
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';

  if (origin) {
    if (allowedOrigin) {
      const isLocal =
        origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      if (origin === allowedOrigin || isLocal) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ── Auth Routes ──────────────────────────────────────────────────────────

  // GET /api/auth/me — retrieve user info from active cookie session
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, {
      success: true,
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    });
  }

  // POST /api/auth/logout — clear cookie session
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', [
      serializeCookie('vd_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 0,
      }),
      serializeCookie('vd_refresh_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 0,
      }),
    ]);
    return sendJson(res, 200, { success: true });
  }

  // POST /api/auth/login — authenticate against users table with bcrypt
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (!loginLimiter(req, res)) return;
    try {
      const bodyStr = await readBody(req);
      const parsedBody = JSON.parse(bodyStr);
      const valResult = validateBody(loginSchema)(parsedBody, res);
      if (!valResult.success) return;
      const { username, password } = valResult.data;

      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) return sendJson(res, 401, { error: 'Invalid credentials' });

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return sendJson(res, 401, { error: 'Invalid credentials' });

      if (user.role !== 'admin') {
        if (user.status === 'pending') {
          return sendJson(res, 403, { error: 'Waiting for admin approval.', status: 'pending' });
        }
        if (user.status === 'denied') {
          return sendJson(res, 403, {
            error: 'Your account request was denied by admin.',
            status: 'denied',
          });
        }
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      res.setHeader('Set-Cookie', [
        serializeCookie('vd_token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: 15 * 60,
        }),
        serializeCookie('vd_refresh_token', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        }),
      ]);

      return sendJson(res, 200, { id: user.id, role: user.role, username: user.username });
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
  }

  // POST /api/auth/register — self-registration (always 'user' role)
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (!loginLimiter(req, res)) return;
    try {
      const bodyStr = await readBody(req);
      const parsedBody = JSON.parse(bodyStr);
      const valResult = validateBody(registerSchema)(parsedBody, res);
      if (!valResult.success) return;
      const { username, password } = valResult.data;

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status',
        [username, hash, 'user', 'pending']
      );
      const u = result.rows[0];
      return sendJson(res, 201, { id: u.id, username: u.username, role: u.role, status: u.status });
    } catch (err) {
      if (err.code === '23505') return sendJson(res, 400, { error: 'Username already taken' });
      return sendJson(res, 400, { error: 'Registration failed' });
    }
  }

  // POST /api/auth/admin-create — admin only
  if (pathname === '/api/auth/admin-create' && req.method === 'POST') {
    if (!requireAuth(req, res, ['admin'])) return;
    if (!adminLimiter(req, res)) return;
    try {
      const bodyStr = await readBody(req);
      const parsedBody = JSON.parse(bodyStr);
      const valResult = validateBody(adminCreateSchema)(parsedBody, res);
      if (!valResult.success) return;
      const { username, password, role } = valResult.data;

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status',
        [username, hash, role, 'approved']
      );
      const u = result.rows[0];
      return sendJson(res, 201, { id: u.id, username: u.username, role: u.role, status: u.status });
    } catch (err) {
      if (err.code === '23505') return sendJson(res, 400, { error: 'Username already taken' });
      return sendJson(res, 400, { error: 'Failed to create user' });
    }
  }

  // GET /api/auth/users/pending-count — admin only
  if (pathname === '/api/auth/users/pending-count' && req.method === 'GET') {
    if (!requireAuth(req, res, ['admin'])) return;
    if (!adminLimiter(req, res)) return;
    try {
      const result = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'pending'");
      return sendJson(res, 200, { count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to fetch pending count' });
    }
  }

  // GET /api/auth/users — admin only
  if (pathname === '/api/auth/users' && req.method === 'GET') {
    if (!requireAuth(req, res, ['admin'])) return;
    if (!adminLimiter(req, res)) return;
    try {
      const result = await pool.query(
        'SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC'
      );
      return sendJson(res, 200, result.rows);
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to fetch users' });
    }
  }

  // PUT /api/auth/users/:id/status — admin only
  if (
    pathname.startsWith('/api/auth/users/') &&
    pathname.endsWith('/status') &&
    req.method === 'PUT'
  ) {
    if (!requireAuth(req, res, ['admin'])) return;
    if (!adminLimiter(req, res)) return;
    const parts = pathname.split('/');
    const id = parseInt(parts[4], 10);
    if (!id) return sendJson(res, 400, { error: 'Invalid user ID' });
    if (req.user.id === id) return sendJson(res, 400, { error: 'Cannot change your own status' });
    try {
      const bodyStr = await readBody(req);
      const parsedBody = JSON.parse(bodyStr);
      const valResult = validateBody(updateStatusSchema)(parsedBody, res);
      if (!valResult.success) return;
      const { status } = valResult.data;

      const result = await pool.query(
        'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, role, status',
        [status, id]
      );
      if (result.rows.length === 0) return sendJson(res, 404, { error: 'User not found' });
      return sendJson(res, 200, {
        message: `User status updated to ${status}`,
        user: result.rows[0],
      });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to update user status' });
    }
  }

  // DELETE /api/auth/users/:id — admin only (cannot delete self)
  if (
    pathname.startsWith('/api/auth/users/') &&
    req.method === 'DELETE' &&
    !pathname.endsWith('/status')
  ) {
    if (!requireAuth(req, res, ['admin'])) return;
    if (!adminLimiter(req, res)) return;
    const id = parseInt(pathname.split('/')[4], 10);
    if (!id) return sendJson(res, 400, { error: 'Invalid user ID' });
    if (req.user.id === id) return sendJson(res, 400, { error: 'Cannot delete your own account' });
    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return sendJson(res, 404, { error: 'User not found' });
      return sendJson(res, 200, { message: 'User deleted' });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to delete user' });
    }
  }

  // ── Legacy Login (env-based, kept for backward compatibility) ───────────────
  if (pathname === '/api/login' && req.method === 'POST') {
    if (!loginLimiter(req, res)) return;
    try {
      const bodyStr = await readBody(req);
      const parsedBody = JSON.parse(bodyStr);
      const valResult = validateBody(loginSchema)(parsedBody, res);
      if (!valResult.success) return;
      const { username, password } = valResult.data;

      let role = null;
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        role = 'admin';
      } else if (username === USER_USER && password === USER_PASS) {
        role = 'user';
      }

      if (!role) {
        return sendJson(res, 401, { success: false, error: 'Invalid username or password' });
      }

      const token = jwt.sign({ id: 9999, username, role }, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: 9999, username, role }, JWT_REFRESH_SECRET, {
        expiresIn: '7d',
      });

      res.setHeader('Set-Cookie', [
        serializeCookie('vd_token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: 15 * 60,
        }),
        serializeCookie('vd_refresh_token', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        }),
      ]);

      return sendJson(res, 200, { success: true, id: 9999, role, username });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: 'Invalid request body' });
    }
  }

  // ── Route Protection ──────────────────────────────────────────────────────
  const adminOnlyRoutes = [
    { path: '/api/import', method: 'POST' },
    { path: '/api/reset', method: 'POST' },
    { path: '/api/data', method: 'POST' },
    { path: '/api/data', method: 'DELETE' },
    { path: '/api/sync-sheet', method: 'POST' },
    { path: '/api/migrate', method: 'POST' },
  ];

  const authRoutes = [
    { path: '/api/data', method: 'GET' },
    { path: '/api/sync-status', method: 'GET' },
    { path: '/api/sheets', method: 'GET' },
    { path: '/api/config', method: 'GET' },
    { path: '/api/security-status', method: 'GET' },
  ];

  const isAdminRoute = adminOnlyRoutes.some((r) => r.path === pathname && r.method === req.method);
  const isAuthRoute =
    authRoutes.some((r) => r.path === pathname && r.method === req.method) ||
    (pathname.startsWith('/api/') &&
      req.method === 'GET' &&
      pathname !== '/api/health' &&
      pathname !== '/api/login');

  if (isAdminRoute) {
    if (!requireAuth(req, res, ['admin'])) return;
    if (['/api/data', '/api/import'].includes(pathname) && req.method === 'POST') {
      if (!uploadLimiter(req, res)) return;
    } else {
      if (!adminLimiter(req, res)) return;
    }
  } else if (isAuthRoute) {
    if (!requireAuth(req, res, ['admin', 'user'])) return;
  }

  // ── API Routing ───────────────────────────────────────────────────────────
  if (['/api/data', '/api/sync-status', '/api/migrate'].includes(pathname)) {
    return handleDataRoutes(req, res, pathname, req.method, parsed);
  }

  if (['/api/import', '/api/reset'].includes(pathname)) {
    return handleImportRoutes(req, res, pathname, req.method);
  }

  if (pathname === '/api/sheets') {
    return handleSheetsRoutes(req, res, pathname, parsed);
  }

  if (['/api/config', '/api/security-status'].includes(pathname)) {
    return handleConfigRoutes(req, res, pathname);
  }

  if (pathname === '/api/health') {
    return handleHealthRoute(req, res, pathname);
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const projectRoot = path.resolve(__dirname, '..', '..');
  const staticRoot = path.join(projectRoot, 'dist');

  const staticFile = path.join(staticRoot, pathname === '/' ? 'index.html' : pathname);

  if (!staticFile.startsWith(staticRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
    const ext = path.extname(staticFile);
    const mime =
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.jsx': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.map': 'application/json',
      }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    return res.end(fs.readFileSync(staticFile));
  }

  // ── SPA fallback → index.html ─────────────────────────────────────────────
  const indexPath = path.join(staticRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(indexPath));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// ── Startup: init Neon table → load rows → start listening ───────────────────
async function startup() {
  if (isMock) {
    console.warn(
      '\n[WARNING] DATABASE_URL is not set or set to mock. Running with in-memory MockPool database.'
    );
  } else {
    console.log('\n[DB] Connecting to Neon PostgreSQL…');
  }
  await initDB();

  // Run migration check automatically at startup
  try {
    const checkRes = await pool.query(
      "SELECT COUNT(*) FROM velan_rows WHERE row_key LIKE '%||%||%||%||%'"
    );
    if (Number(checkRes.rows[0].count) > 0) {
      console.log('[DB] Migration needed: Converting old row keys and deduplicating...');
      await runKeyMigration();
    }
  } catch (err) {
    console.error('[DB] Pre-startup migration check failed:', err.message);
  }

  // Load last sync timestamp from logs
  try {
    const syncRes = await pool.query(
      "SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1"
    );
    if (syncRes.rows.length > 0) {
      state._lastSync = new Date(syncRes.rows[0].created_at).toLocaleString('en-IN');
    }
  } catch (_) {}

  state._db = await loadDB();
  const liveDb = await loadLiveDB();
  state._liveRows = liveDb;
  console.log(
    `[DB] Loaded ${state._db.length} archive rows and ${state._liveRows.length} live rows from Neon`
  );
  console.log('[STATIC] Serving from:', path.resolve(__dirname, '..', '..', 'dist'));
  console.log(
    '[STATIC] index.html exists:',
    fs.existsSync(path.join(path.resolve(__dirname, '..', '..', 'dist'), 'index.html'))
  );

  server.listen(PORT, () => {
    console.log(`\n┌─────────────────────────────────────────────────┐`);
    console.log(`│  Velan Metrology Dashboard — Backend Server     │`);
    console.log(`│  http://localhost:${PORT}                          │`);
    console.log(`│  Data:   http://localhost:${PORT}/api/data          │`);
    console.log(`│  Import: http://localhost:${PORT}/api/import        │`);
    console.log(`│  Reset:  http://localhost:${PORT}/api/reset         │`);
    console.log(`│  Sheets: http://localhost:${PORT}/api/sheets        │`);
    console.log(`│  Health: http://localhost:${PORT}/api/health        │`);
    console.log(`└─────────────────────────────────────────────────┘`);
    console.log(`  Storage: Neon PostgreSQL (no local file needed)`);
    console.log(
      `  DB rows: ${state._db.length} archive rows | ${state._liveRows.length} live rows`
    );
    console.log(`  LIVE_URL:    ${LIVE_URL ? LIVE_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`);
    console.log(
      `  HISTORY_URL: ${HISTORY_URL ? HISTORY_URL.substring(0, 60) + '...' : '⚠  NOT SET'}`
    );
    console.log('');
  });
}

startup().catch((err) => {
  console.error('[STARTUP FAILED]', err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — closing Neon pool…`);
  await pool.end();
  server.close(() => {
    console.log('[Server] Closed. Goodbye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
