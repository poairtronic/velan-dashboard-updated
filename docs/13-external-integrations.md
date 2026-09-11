# 13 - External Integrations

## 1. Google Sheets Integration

### Purpose & Architecture
Google Sheets serves as the primary live operational data entry surface for shop-floor operators. The application synchronizes with published Google Sheets without requiring OAuth credentials or API quotas by utilizing Google's Web CSV Publishing feature.

```
┌──────────────────────────────────────┐
│  Shop Floor Operator (Google Sheets) │
│  Enters daily job updates            │
└──────────────────┬───────────────────┘
                   │ Published to Web as CSV
                   ▼
┌──────────────────────────────────────┐
│  Google Web Server                   │
│  https://docs.google.com/.../pub?csv │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Velan Dashboard Proxy (/api/sheets) │
│  1. Validates host whitelist (SSRF)  │
│  2. Fetches CSV stream via fetch()   │
│  3. Returns raw text to client       │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Client Excel Parser & Ingestion     │
│  Parses CSV -> Normalizes -> API     │
└──────────────────────────────────────┘
```

### Configuration & SSRF Validation
- **URL Normalization (`src/services/googleSheets.js`):** Automatically converts standard Google Sheets sharing links (`/edit#gid=...`) into public CSV export URLs (`/export?format=csv&gid=...`).
- **SSRF Whitelist Protection (`src/server/utils/helpers.js`):** Only URLs containing hostnames `docs.google.com` or `docs.googleusercontent.com` are permitted.
- **Polling Loop (`src/hooks/useLiveSync.js`):** Polls the live sheet on a configurable interval (default: 300 seconds).

---

## 2. Neon PostgreSQL Database Integration

- **Service:** Neon Serverless PostgreSQL.
- **Connection Model:** Managed connection pool (`pg.Pool`) configured in `src/server/db/pool.js` with `max: 20` connections and SSL encryption (`rejectUnauthorized: false`).
- **Extensions:** Automatically provisions the `pg_trgm` extension at startup for GIN trigram text indexing.
- **Resilience:** If the database connection is interrupted, the pool logs errors to `logger.categories.DATABASE` and broadcasts a `system:error` event to active WebSocket clients.

---

## 3. Upstash Redis & Redis Cloud Integration

- **Service:** Upstash Redis (Serverless REST API) & standard TCP Redis (for BullMQ).
- **Dual Client Wrapper:**
  - **REST Client (`@upstash/redis`):** Used for lightweight HTTP-based caching of dashboard KPI calculations, rate limiting, and temporary file download storage.
  - **TCP Client (`ioredis` / BullMQ):** Used by BullMQ for background job queue event subscriptions.
- **Fail-Safe Degradation:** If Redis becomes unavailable, `src/server/cache/cacheService.js` automatically catches errors, marks Redis as offline, and degrades gracefully to direct PostgreSQL queries without throwing unhandled exceptions.

---

## 4. Monitoring & Telemetry Integrations (Optional)

### 4.1 Sentry (`src/utils/sentry.js`)
- Initialized if `VITE_SENTRY_DSN` is configured in `.env`.
- Captures frontend uncaught exceptions and React Error Boundary crashes.

### 4.2 LogRocket (`src/utils/logrocket.js`)
- Initialized if `VITE_LOGROCKET_APP_ID` is configured in `.env`.
- Records user session replays, console logs, and network telemetry for debugging.
