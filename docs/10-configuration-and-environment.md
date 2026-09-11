# 10 - Configuration & Environment Variables

## 1. Environment Variable Specification

The server validates all environment variables at startup using **Zod** in `src/server/config/env.js`. If any required variable fails validation, the server logs formatted errors and halts execution immediately.

---

## 2. Environment Variable Catalog

| Variable Name | Required? | Default Value | Description & Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `'development'` | Application environment: `'development'`, `'production'`, or `'test'`. |
| `PORT` | Optional | `10000` | Port number on which the Express server listens. |
| `DATABASE_URL` | **Required (Prod)** | `'mock'` | PostgreSQL connection string (e.g., Neon Cloud connection URL `postgresql://user:pass@host/db?sslmode=require`). |
| `DB_POOL_MAX` | Optional | `20` | Maximum number of concurrent connections in the `pg.Pool`. |
| `JWT_SECRET` | **Required (Prod)** | Ephemeral Random | Secret key used to sign and verify 15-minute access tokens (`vd_token`). |
| `JWT_REFRESH_SECRET` | **Required (Prod)** | Ephemeral Random | Secret key used to sign and verify 7-day refresh tokens (`vd_refresh_token`). |
| `UPSTASH_REDIS_REST_URL` | Optional | `undefined` | REST API URL for Upstash Redis caching (e.g., `https://...upstash.io`). |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | `undefined` | REST API authentication bearer token for Upstash Redis. |
| `REDIS_URL` | Optional | `undefined` | TCP Redis connection URL (e.g., `redis://localhost:6379`) used by BullMQ job workers. Falls back to mock queue if omitted. |
| `ALLOWED_ORIGIN` | Optional | `''` | Whitelisted frontend origin for CORS requests in production (e.g., `https://dashboard.velanmetrology.com`). |
| `LIVE_URL` | Optional | `''` | Default Google Sheets published CSV URL for the live shop floor snapshot. |
| `HISTORY_URL` | Optional | `''` | Default Google Sheets published CSV URL for historical data backup and reset restoration. |
| `ADMIN_USER` | Optional | `undefined` | Username for legacy admin credentials fallback. |
| `ADMIN_PASS` | Optional | `undefined` | Password for legacy admin credentials fallback. |
| `USER_USER` | Optional | `undefined` | Username for legacy standard user credentials fallback. |
| `USER_PASS` | Optional | `undefined` | Password for legacy standard user credentials fallback. |
| `API_SECRET` | Optional | `undefined` | Secret API key allowing automated programmatic access via the `x-api-key` HTTP header. |
| `CACHE_TTL` | Optional | `60` | Default cache time-to-live in seconds. |
| `VITE_API_BASE` | Optional (Frontend)| `''` | Base API URL used by the frontend if API is hosted on a different domain or port. |
| `VITE_SENTRY_DSN` | Optional (Frontend)| `''` | Sentry project DSN for client-side crash and error reporting. |
| `VITE_LOGROCKET_APP_ID`| Optional (Frontend)| `''` | LogRocket application ID for frontend user session recording. |

---

## 3. Example `.env` File Template

```env
# Server Configuration
NODE_ENV=production
PORT=10000
ALLOWED_ORIGIN=https://velan-dashboard.onrender.com

# Database (PostgreSQL - Neon)
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-velan-metrology.us-east-2.aws.neon.tech/neondb?sslmode=require
DB_POOL_MAX=20

# Authentication & JWT Secrets (Generate with `openssl rand -hex 32`)
JWT_SECRET=f9b2d8e47a1c9038e55208492c10b42f638194e8271038475a9c0182746b5e01
JWT_REFRESH_SECRET=7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b
API_SECRET=velan_secure_api_key_2026

# Upstash Redis Cache
UPSTASH_REDIS_REST_URL=https://YOUR-UPSTASH-INSTANCE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@YOUR-REDIS-HOST:6379

# Google Sheets Default Integrations
LIVE_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv
HISTORY_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv

# Frontend Telemetry (Optional)
VITE_SENTRY_DSN=
VITE_LOGROCKET_APP_ID=
```
