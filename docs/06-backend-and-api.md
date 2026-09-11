# 06 - Backend & API Reference

## 1. Backend Architecture & Route Directory

The backend exposes **23 dedicated Express router modules** mounted under `/api` in `src/server/app.js`.

---

## 2. Complete API Endpoint Catalog

### 2.1 Authentication & User Management (`src/server/routes/auth.js`)

| Method | Endpoint | Access | Request Body / Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | `{ username, password }` | Authenticates user; issues HttpOnly `vd_token` (15m) and `vd_refresh_token` (7d). Supports legacy credentials. |
| `POST` | `/api/auth/register`| Public | `{ username, password }` | Registers a new account with `pending` status. |
| `POST` | `/api/auth/logout` | Authenticated | None | Clears JWT cookies and logs audit event. |
| `GET` | `/api/auth/me` | Authenticated | None | Returns active user session identity and role. |
| `GET` | `/api/auth/users` | Admin | None | Lists all registered users with approval status. |
| `POST` | `/api/auth/admin-create`| Admin | `{ username, password, role }` | Creates a pre-approved user account. |
| `PUT` | `/api/auth/users/:id/status`| Admin | `{ status: 'approved'\|'denied' }` | Updates a user's account status. |
| `DELETE`| `/api/auth/users/:id` | Admin | None | Permanently deletes a user account. |
| `GET` | `/api/auth/users/pending-count`| Admin| None | Count of users awaiting admin approval. |

### 2.2 Production & Historical Data (`src/server/routes/data.js` & `import.js`)

| Method | Endpoint | Access | Request Body / Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/data` | User / Admin | `?page=1&limit=500&search=` | Retrieves paginated historical rows and live snapshot rows. |
| `GET` | `/api/data/production` | User / Admin | `?page=1&limit=100&po=&stage=&...` | Server-side filtered and paginated production rows for large datasets. |
| `POST` | `/api/data` | Admin | `{ rows: [...] }` | Replaces live snapshot (`velan_live_rows`) and upserts new rows to `velan_rows` via `syncQueue`. |
| `DELETE`| `/api/data` | Admin | None | Wipes all production rows from database. |
| `POST` | `/api/import` | Admin | `{ rows: [...], url: "...", replace: false }` | Bulk historical import with deduplication via `syncQueue`. |
| `POST` | `/api/reset` | Admin | None | Wipes database and optionally re-imports from `HISTORY_URL`. |
| `GET` | `/api/sheets` | User / Admin | `?url=<encodedUrl>` | SSRF-safe proxy to stream Google Sheets CSV data. |
| `GET` | `/api/sync-status` | User / Admin | None | Returns synchronization history and error logs. |

### 2.3 Dashboard Analytics & Calculations (`src/server/routes/dashboard.js`)

| Method | Endpoint | Access | Query Parameters | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/calculations` | User / Admin | Filter params (`po`, `stage`, `type`, `inhouse`, `category`, `search`, `fromDate`, `toDate`, `source`) | Comprehensive aggregated calculations: KPIs, stages, bottlenecks, vendors, and cycle times (cached for 300s). |
| `GET` | `/api/dashboard/kpis` | User / Admin | Filter params | Computes OTD %, WIP, inhouse/vendor split, and daily output. |
| `GET` | `/api/dashboard/stages` | User / Admin | Filter params | Stage distribution counts and queue sizes. |
| `GET` | `/api/dashboard/cycle-times` | User / Admin | Filter params | Stage transition durations and time-to-reach metrics. |
| `GET` | `/api/dashboard/vendors` | User / Admin | Filter params | Sub-contractor vendor aging, pending days, and SLA violation rates. |
| `GET` | `/api/dashboard/bottlenecks` | User / Admin | Filter params | Ranks stages by bottleneck score ($Queue \times Duration$). |

### 2.4 Manufacturing Intelligence & Forecasting (`src/server/routes/mic.js`, `forecast.js`, `executive.js`, `drilldown.js`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/mic` or `/api/intelligence`| User / Admin | Plant Health Score (0–100), Throughput velocity, Queue clearance, Root cause analysis, and Action Center. |
| `GET` | `/api/forecast/sla` | User / Admin | Projects PO completion dates, delay probabilities (%), and breach risks. |
| `GET` | `/api/forecast/capacity` | User / Admin | Calculates weighted daily stage outflow (70/30) and capacity utilization. |
| `GET` | `/api/forecast/queue` | User / Admin | Queue clearance projections for all active shop-floor stages. |
| `GET` | `/api/forecast/vendor-risk` | User / Admin | Sub-contractor risk matrix and SLA failure trends. |
| `GET` | `/api/forecast/bottleneck` | User / Admin | Detects current bottleneck and projects next bottleneck at +14 days. |
| `GET` | `/api/forecast/plant-risk` | User / Admin | Composite operational plant risk analysis. |
| `GET` | `/api/executive/war-room` | User / Admin | Executive summary of critical stage queues ($\ge 20$ items) and operational risks. |
| `GET` | `/api/drilldown/:kpiType` | User / Admin | Modal drilldowns for `otd`, `bottleneck`, `vendor`, `inventory`, `wip`. |

### 2.5 Cutting & Raw Material Inventory (`src/server/routes/inventory.js`)

| Method | Endpoint | Access | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory/long-bars` | User / Admin | None | Lists raw bar stock inventory with current lengths. |
| `POST` | `/api/inventory/long-bars` | User / Admin | `{ barType, originalLength }` | Adds a new long bar to inventory. |
| `GET` | `/api/inventory/cut-pieces` | User / Admin | None | Master list of defined cut piece specifications. |
| `POST` | `/api/inventory/cut-pieces/define`| User / Admin | `{ cutPieceName, parentBarType, cutDimension }` | Registers a cut piece specification. |
| `GET` | `/api/inventory/stock` | User / Admin | None | Current on-hand quantity of all cut pieces. |
| `POST` | `/api/inventory/cut-piece` | User / Admin | `{ longBarId, cutPieceName, cutDimension, quantity, createdBy }` | **Atomic cut transaction** (`SELECT FOR UPDATE`): reduces bar length, increments inventory, and logs production. |
| `GET` | `/api/inventory/production-history`| User / Admin | None | Recent long bar cutting logs. |
| `GET` | `/api/inventory/fine-blanks` | User / Admin | None | Master list of fine blank specifications. |
| `POST` | `/api/inventory/fine-blanks/define`| User / Admin | `{ fineBlankName, parentCutPieceType, dimension, material, description }` | Registers fine blank specification. |
| `GET` | `/api/inventory/fine-blank-stock`| User / Admin | None | On-hand quantity of fine blanks. |
| `POST` | `/api/inventory/fine-blank/produce`| User / Admin | `{ cutPieceId, fineBlankName, consumedQty, producedQty, remarks, createdBy }` | **Atomic stamping transaction**: consumes cut pieces and produces fine blanks. |
| `GET` | `/api/inventory/fine-blank-history`| User / Admin | None | Recent fine blank stamping logs. |

### 2.6 Alerts, Timeline, Governance & System (`src/server/routes/alerts.js`, `timeline.js`, `reports.js`, `audit.js`, `performance.js`, `health.js`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alerts` | User / Admin | Retrieves active operational and security alerts. |
| `PUT` | `/api/alerts/read` | User / Admin | Marks alert IDs as read and broadcasts WebSocket update. |
| `GET` | `/api/alerts/rules` | Admin | Lists active alert trigger rules and threshold values. |
| `PUT` | `/api/alerts/rules` | Admin | Updates alert rule thresholds and recipient lists. |
| `GET` | `/api/timeline` | User / Admin | Chronological log of shop-floor milestone events. |
| `POST` | `/api/reports/generate` | User / Admin | Dispatches asynchronous PDF, CSV, or JSON export job to BullMQ. |
| `GET` | `/api/reports/status/:jobId` | User / Admin | Polling endpoint for export job completion. |
| `GET` | `/api/reports/download/:jobId` | User / Admin | Downloads generated report binary from Redis cache (1h TTL). |
| `GET` | `/api/audit/history` | Admin | Queries compliance audit logs with filtering by user, action, and date. |
| `GET` | `/api/perf/report` | Admin | Endpoint response time percentiles (p50/p95/p99) and cache ratios. |
| `GET` | `/api/health` | Public | System health check (DB connectivity, Redis status, uptime). |
| `GET` | `/api/security-status` | User / Admin | Validates active security headers and environment posture. |
