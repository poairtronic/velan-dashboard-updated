const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { authenticate, requireAuth } = require('./middleware/auth');
const { syncLimiter, dashboardLimiter } = require('./middleware/rateLimit');
const { env } = require('./config/env');

// Routers
const authRouter = require('./routes/auth');
const dataRouter = require('./routes/data');
const auditRouter = require('./routes/audit');
const metaRouter = require('./routes/meta').router;
const syncStatusRouter = require('./routes/syncStatus');
const migrateRouter = require('./routes/migrate');
const importRouter = require('./routes/import');
const sheetsRouter = require('./routes/sheets');
const reportsRouter = require('./routes/reports');
const configRouter = require('./routes/config');
const securityRouter = require('./routes/security');
const healthRouter = require('./routes/health');
const dashboardRouter = require('./routes/dashboard');
const adminRouter = require('./routes/admin');
const alertsRouter = require('./routes/alerts');
const timelineRouter = require('./routes/timeline');
const drilldownRouter = require('./routes/drilldown');
const executiveRouter = require('./routes/executive');

const intelligenceRouter = require('./routes/intelligence');
const micRouter = require('./routes/mic');
const forecastRouter = require('./routes/forecast');

const app = express();

// Trust first proxy (Render Load Balancer)
app.set('trust proxy', 1);

// ── Security Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
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
      "worker-src 'self' blob:; " +
      "img-src 'self' data:; " +
      "frame-ancestors 'none';"
  );
  next();
});

// ── CORS headers with Credentials support ─────────────────────────────────
const allowedOrigin = env.ALLOWED_ORIGIN || '';
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigin) {
      const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      if (origin === allowedOrigin || isLocal) {
        return callback(null, true);
      }
      return callback(null, false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Middlewares
app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(authenticate); // Set req.user for all routes
// Rate limiters removed from here as they are imported above

// ── API Routing with Route Protection ─────────────────────────────────────
const apiRouter = express.Router();

// Public routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/health', healthRouter);

// Admin only routes
apiRouter.use('/migrate', requireAuth(['admin']), migrateRouter);

apiRouter.use('/reset', requireAuth(['admin']), (req, res, next) => {
  // Map /api/reset to the /reset endpoint of import router
  req.url = '/reset' + req.url;
  importRouter(req, res, next);
});
apiRouter.use('/import', requireAuth(['admin']), syncLimiter, (req, res, next) => {
  // Map /api/import to the /import endpoint of import router
  req.url = '/import' + req.url;
  importRouter(req, res, next);
});

// Mixed protection routes
apiRouter.use('/data', dashboardLimiter, (req, res, next) => {
  if (req.method === 'POST') {
    return requireAuth(['admin'])(req, res, (err) => {
      if (err) return next(err);
      syncLimiter(req, res, next);
    });
  } else if (req.method === 'DELETE') {
    return requireAuth(['admin'])(req, res, next);
  }
  return requireAuth(['admin', 'user'])(req, res, next);
}, dataRouter);

// Auth (user/admin) routes
apiRouter.use('/sync-status', requireAuth(['admin', 'user']), syncStatusRouter);
apiRouter.use('/sheets', requireAuth(['admin', 'user']), sheetsRouter);
apiRouter.use('/config', requireAuth(['admin', 'user']), configRouter);
apiRouter.use('/security-status', requireAuth(['admin', 'user']), securityRouter);
apiRouter.use('/reports', requireAuth(['admin', 'user']), reportsRouter);
apiRouter.use('/dashboard', dashboardLimiter, requireAuth(['admin', 'user']), dashboardRouter);
apiRouter.use('/admin', requireAuth(['admin']), adminRouter);
apiRouter.use('/alerts', dashboardLimiter, requireAuth(['admin', 'user']), alertsRouter);
apiRouter.use('/timeline', dashboardLimiter, requireAuth(['admin', 'user']), timelineRouter);
apiRouter.use('/intelligence', dashboardLimiter, requireAuth(['admin', 'user']), intelligenceRouter);
apiRouter.use('/mic', dashboardLimiter, requireAuth(['admin', 'user']), micRouter);
apiRouter.use('/forecast', dashboardLimiter, requireAuth(['admin', 'user']), forecastRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/meta', requireAuth(['admin', 'user']), metaRouter);

app.use('/api', apiRouter);

app.use('/api/drilldown', drilldownRouter);
app.use('/api/executive', executiveRouter);


// ── Static files ──────────────────────────────────────────────────────────
const projectRoot = path.resolve(__dirname, '..', '..');
const staticRoot = path.join(projectRoot, 'dist');
app.use(express.static(staticRoot));

// ── SPA fallback → index.html ─────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.originalUrl.startsWith('/api')) {
    return next(); // pass to 404 handler
  }
  const indexPath = path.join(staticRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// 404 & Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
