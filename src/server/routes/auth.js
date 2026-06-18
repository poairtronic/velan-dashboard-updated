const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { env } = require('../config/env');
const { requireAuth, authenticate } = require('../middleware/auth');
const { authLimiter, dashboardLimiter } = require('../middleware/rateLimit');
const { loginSchema, registerSchema } = require('../schemas/auth.schema');
const { adminCreateSchema, updateStatusSchema } = require('../schemas/user.schema');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;
const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

// GET /api/auth/me
router.get('/me', requireAuth(), (req, res) => {
  return res.json({
    success: true,
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  if (req.user) {
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({ req, action: 'USER_LOGOUT' });
  }
  res.clearCookie('vd_token', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  res.clearCookie('vd_refresh_token', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  return res.json({ success: true });
}));

// POST /api/auth/login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const valResult = loginSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: valResult.error.errors });
  }
  const { username, password } = valResult.data;

  // Legacy Login Fallback
  if (username === env.ADMIN_USER && password === env.ADMIN_PASS) {
    return handleLegacyLogin(req, res, 'admin', username);
  } else if (username === env.USER_USER && password === env.USER_PASS) {
    return handleLegacyLogin(req, res, 'user', username);
  }

  // Normal Login
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (user.role !== 'admin') {
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Waiting for admin approval.', status: 'pending' });
    }
    if (user.status === 'denied') {
      return res.status(403).json({ error: 'Your account request was denied by admin.', status: 'denied' });
    }
  }

  setAuthCookies(res, user);
  const { logAudit } = require('../utils/auditLogger');
  await logAudit({ req, userId: user.id, userEmail: user.username, action: 'USER_LOGIN' });
  return res.json({ id: user.id, role: user.role, username: user.username });
}));

// POST /api/auth/register
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const valResult = registerSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: valResult.error.errors });
  }
  const { username, password } = valResult.data;

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status',
      [username, hash, 'user', 'pending']
    );
    const u = result.rows[0];
    return res.status(201).json({ id: u.id, username: u.username, role: u.role, status: u.status });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    return res.status(400).json({ error: 'Registration failed' });
  }
}));

// POST /api/auth/admin-create
router.post('/admin-create', requireAuth(['admin']), dashboardLimiter, asyncHandler(async (req, res) => {
  const valResult = adminCreateSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: valResult.error.errors });
  }
  const { username, password, role } = valResult.data;

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status',
      [username, hash, role, 'approved']
    );
    const u = result.rows[0];
    return res.status(201).json({ id: u.id, username: u.username, role: u.role, status: u.status });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    return res.status(400).json({ error: 'Failed to create user' });
  }
}));

// GET /api/auth/users/pending-count
router.get('/users/pending-count', requireAuth(['admin']), dashboardLimiter, asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'pending'");
  return res.json({ count: parseInt(result.rows[0].count, 10) });
}));

// GET /api/auth/users
router.get('/users', requireAuth(['admin']), dashboardLimiter, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC');
  return res.json(result.rows);
}));

// PUT /api/auth/users/:id/status
router.put('/users/:id/status', requireAuth(['admin']), dashboardLimiter, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });
  if (req.user.id === id) return res.status(400).json({ error: 'Cannot change your own status' });

  const valResult = updateStatusSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: valResult.error.errors });
  }
  const { status } = valResult.data;

  const result = await pool.query(
    'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, role, status',
    [status, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ message: `User status updated to ${status}`, user: result.rows[0] });
}));

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth(['admin']), dashboardLimiter, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });
  if (req.user.id === id) return res.status(400).json({ error: 'Cannot delete your own account' });

  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ message: 'User deleted' });
}));

// Helpers
function setAuthCookies(res, user) {
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  res.cookie('vd_token', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('vd_refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
}

async function handleLegacyLogin(req, res, role, username) {
  setAuthCookies(res, { id: 9999, username, role });
  const { logAudit } = require('../utils/auditLogger');
  await logAudit({
    userId: 9999,
    userEmail: username,
    action: 'USER_LOGIN',
    metadata: { legacy: true, role },
    req
  });
  return res.json({ success: true, id: 9999, role, username });
}

module.exports = router;
