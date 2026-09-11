# 02 - Project Architecture

## 1. High-Level System Architecture

The Velan Dashboard follows a decoupled **Client-Server Architecture** augmented with an asynchronous background task queue, multi-layer caching, and a real-time WebSocket state-broadcasting bus.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATA INGESTION                                       │
│   ┌───────────────────────────────┐           ┌────────────────────────────────────┐   │
│   │ Google Sheets (Live Web CSV)  │           │ Excel / CSV Files (.xlsx, .csv)    │   │
│   └───────────────┬───────────────┘           └─────────────────┬──────────────────┘   │
└───────────────────┼─────────────────────────────────────────────┼──────────────────────┘
                    │                                             │
                    ▼                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION SERVER (EXPRESS 5)                            │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Middlewares: requestLogger, rateLimit (Redis), auth (JWT Cookie), perfContext   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Routers (/api): auth, data, dashboard, forecast, mic, inventory, alerts, etc.  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                        │
│   ┌────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────┐   │
│   │ Caching Layer          │  │ BullMQ Queue System     │  │ WebSocket Server (ws) │   │
│   │ - Upstash Redis Client │  │ - syncQueue             │  │ - Heartbeat (30s)     │   │
│   │ - Hash filter keys     │  │ - exportQueue           │  │ - sync:completed      │   │
│   │ - TTL: 5m/15m/30m/1h   │  │ - reportQueue           │  │ - alert:created       │   │
│   └───────────┬────────────┘  └───────────┬─────────────┘  └───────────┬───────────┘   │
└───────────────┼───────────────────────────┼────────────────────────────┼───────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌──────────────────────────────────────────────────────────┐ ┌───────────────────────────┐
│               DATABASE LAYER (POSTGRESQL - NEON)         │ │   FRONTEND LAYER (REACT)  │
│ - `velan_live_rows`: Active operational items            │ │ - AuthContext, DataContext│
│ - `velan_rows`: Cumulative archive with GIN Trigram index│ │ - TanStack React Query    │
│ - `alerts`, `alert_rules`, `operational_timeline`        │ │ - useWebSocket invalidator│
│ - `long_bars`, `cut_pieces`, `cut_piece_inventory`       │ │ - 20 Interactive Pages    │
│ - `fine_blanks`, `fine_blank_inventory`, `audit_log`     │ │ - Chart.js & Tailwind CSS │
└──────────────────────────────────────────────────────────┘ └───────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 State Management & Context Hierarchy
The React SPA (`src/App.jsx`) wraps the application in four cascading Context Providers:

1. **`AuthContext` (`src/context/AuthContext.jsx`):**
   - Manages user identity (`user`), roles (`role`: `'admin'` | `'user'`), approval status (`'approved'`, `'pending'`, `'denied'`), and login/logout state.
   - Restores session automatically via `GET /api/auth/me` on mount.
2. **`UIContext` (`src/context/UIContext.jsx`):**
   - Manages global UI elements: `serverStatus` (`'ready'`, `'loading'`, `'offline'`), `isLoading`, upload progress indicators, modal open/close states, and theme toggling.
3. **`FilterContext` (`src/context/FilterContext.jsx`):**
   - Holds the global query filter state: `po`, `stage`, `type`, `inhouse`, `category`, `search`, `fromDate`, `toDate`, `dateType` (`'poDate'` vs `'timestamp'`), and `source` (`'live'` vs `'database'`).
4. **`DataContext` (`src/context/DataContext.jsx`):**
   - Orchestrates data synchronization, mutations (`saveRows`, `importRows`, `resetDB`), live Google Sheets polling intervals, and hooks into `useBackendKPIs`.

### 2.2 Routing & Component Hierarchy
Routing is powered by `react-router-dom` (v7) with role-protected route guards (`src/components/ProtectedRoute.jsx`):

```text
App.jsx
 ├── Sidebar (Navigation & Pending User Badges)
 ├── Header (System Health, Global Search, User Profile, Theme Switcher)
 ├── CommandPalette (Keyboard Shortcut Ctrl+K / Cmd+K)
 └── Routes:
     ├── /login (LoginPage.jsx)
     ├── /overview (OverviewPage.jsx)
     ├── /executive-war-room (ExecutiveWarRoom.jsx)
     ├── /manufacturing-intelligence (ManufacturingIntelligencePage.jsx)
     ├── /predictive-analytics (PredictiveAnalyticsPage.jsx)
     ├── /production (ProductionPage.jsx)
     ├── /wip (WIPPage.jsx)
     ├── /bottleneck (BottleneckPage.jsx)
     ├── /cycle-time (CycleTimePage.jsx)
     ├── /vendor (VendorPage.jsx)
     ├── /po (POPage.jsx)
     ├── /sc (SCPage.jsx)
     ├── /month-day (MonthDayPage.jsx)
     ├── /inventory (InventoryPage.jsx)
     ├── /database (DatabasePage.jsx)
     ├── /upload (UploadPage.jsx)
     ├── /audit-trail (AuditTrailViewer.jsx - Admin only)
     ├── /user-management (UserManagementPage.jsx - Admin only)
     └── /enterprise-health (EnterpriseHealthPage.jsx)
```

---

## 3. Backend Architecture

### 3.1 Entry Point & Orchestration
- **`server.js`:** The root bootstrap file that imports `src/server/server.js`.
- **`src/server/server.js`:**
  - Creates the HTTP server instance and binds the WebSocket server (`initWebSocket`).
  - Executes the asynchronous startup sequence:
    1. Connects to PostgreSQL (`initDB()`).
    2. Runs automated schema migrations and row key format checks (`runKeyMigration()`).
    3. Loads previous sync timestamp from `sync_logs`.
    4. Pre-warms in-memory operational snapshot (`loadLiveDB()`).
    5. Starts HTTP listening on `PORT` (default 10000).
    6. Registers graceful shutdown hooks for `SIGTERM` and `SIGINT`.
- **`src/server/app.js`:** Configures Express middlewares, security policies, CORS origin verification, and mounts 23 dedicated router files under `/api`.

### 3.2 Service & Business Logic Layer
All business logic is isolated in pure, deterministic calculation modules located in `src/server/services/` and `src/server/forecast/`:
- `dataQueryService.js`: Merges, normalizes, and filters live vs. archive records.
- `kpiService.js`: Generates overall operational KPIs, output counts, and OTD statistics.
- `bottleneckService.js`: Identifies stage accumulation scores and ranks bottleneck severity.
- `cycleTimeService.js`: Calculates stage-to-stage transition durations and overall cycle times.
- `vendorService.js`: Analyzes external sub-contractor aging and SLA violation rates.
- `alertEngine.js`: Evaluates rules against live data, creates alerts, and appends timeline events.
- `micService.js`: Computes Plant Health Scores, root-cause impact, and recommended executive actions.
- `forecast/`: Modules for SLA projection, capacity planning, queue clearance, and plant risk.

---

## 4. Data Architecture & Storage Strategy

### 4.1 Hybrid Storage Design
The application uses a hybrid data model:
1. **JSONB Document Storage for Flexible Production Rows:** The core production rows in `velan_live_rows` and `velan_rows` store tabular manufacturing fields inside a `JSONB` column (`data`). This accommodates variations in spreadsheet headers without requiring frequent SQL schema modifications.
2. **Relational Tables for Enterprise Governance & Inventory:** Strict relational schemas are used for users, authentication, alert rules, security audit logs, performance logs, and the cutting/fine-blank inventory system.

### 4.2 Caching Strategy (`src/server/cache/`)
- **Redis Primary (Upstash Redis REST API or TCP):**
  - **DASHBOARD_KPIS:** Cached for 300 seconds using an MD5 hash of active filter parameters (`dashboard:kpis:<hash>`).
  - **DASHBOARD_DATA:** Paginated rows cached by page, limit, and search string (`dashboard:data:<page>:<limit>:<search>`).
  - **Reports Storage:** Generated export binaries (PDF, CSV, JSON) are stored in Redis under `export:<jobId>` with an automatic 1-hour expiration TTL (3600s).
- **Graceful In-Memory Fallback:** If Redis is unreachable, `cacheService.js` automatically catches errors, marks Redis as unavailable, and falls back directly to PostgreSQL queries without crashing the server.

---

## 5. Integration Architecture

### 5.1 Google Sheets Live Pipeline
- Published Google Sheets CSV endpoints are polled by `useLiveSync.js` on configurable intervals (default: 300 seconds).
- The `/api/sheets` backend proxy verifies that incoming URLs belong to `docs.google.com` or `docs.googleusercontent.com` to prevent Server-Side Request Forgery (SSRF).
- The response is parsed with PapaParse, normalized via `normalizeRow.js`, and dispatched to `/api/data`.

### 5.2 Cutting Workshop Subsystem (`cutting-dashboard/`)
The codebase includes a dedicated NestJS cutting inventory module (`cutting-dashboard/backend/`) and React view (`cutting-dashboard/frontend/`). The core logic of this subsystem has also been integrated natively into the main Express backend (`src/server/routes/inventory.js`) to provide unified API access for long bar reductions, cut piece definitions, and fine blank stamping.
