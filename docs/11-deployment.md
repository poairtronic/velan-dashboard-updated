# 11 - Deployment & Infrastructure

## 1. Hosting & Infrastructure Architecture

The Velan Dashboard is designed for deployment on modern cloud platforms (Render, Railway, AWS ECS, DigitalOcean, or Heroku) with a **Single-Origin Monolith** model:
- The React SPA is built into static assets (`dist/`) during CI/CD or build time.
- The Node.js Express server serves both the REST API `/api/*`, the WebSocket endpoint `/`, and serves the static files from `dist/` with a wildcard SPA fallback to `index.html`.

```
┌─────────────────────────────────────────────────────────────┐
│                 Cloud Provider (e.g. Render)                │
│                                                             │
│   Incoming HTTPS Request (Port 443)                         │
│                  │                                          │
│                  ▼                                          │
│   Render Load Balancer (SSL Termination, Proxy)             │
│                  │                                          │
│                  ▼                                          │
│   Node.js Server (Port 10000)                               │
│     ├── /api/*          ──> Handled by Express Router       │
│     ├── /ws             ──> Upgraded to WebSocket           │
│     └── /* (static/SPA) ──> Serves `dist/index.html`        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│   Neon PostgreSQL Database  │ │    Upstash Redis Cloud      │
│   (Serverless PostgreSQL)   │ │    (Key-Value Cache)        │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Build & Deployment Lifecycle

### 2.1 Build Command
```bash
npm run build
```
Executes `vite build`, which:
1. Compiles and minifies React JSX, CSS, and assets into `dist/`.
2. Emits chunked, cache-busted JavaScript bundles (e.g., `dist/assets/index-*.js`).

### 2.2 Production Startup Command
```bash
npm start
```
Executes `node src/server/server.js`, which:
1. Initializes the Neon PostgreSQL database pool (`initDB()`).
2. Runs key migration checks (`runKeyMigration()`).
3. Connects to Upstash Redis and initializes BullMQ background workers.
4. Binds Express and the WebSocket server to `process.env.PORT` (or default `10000`).

---

## 3. Render / Production Configuration (`render.yaml` or UI)

- **Environment:** Node
- **Node Version:** `>= 18.x` (Recommended: `20.x` or `22.x`)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- **Auto-Deploy:** Enabled on git push to `main`.

---

## 4. Reverse Proxy & SSL Configuration
- In `src/server/app.js`, Express sets `app.set('trust proxy', 1)` to correctly recognize headers (`x-forwarded-proto`, `x-forwarded-for`) injected by cloud load balancers.
- When `x-forwarded-proto === 'https'`, the server automatically sets `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- Cookies (`vd_token`, `vd_refresh_token`) use `secure: true` and `sameSite: 'Lax'`, requiring HTTPS in production.
