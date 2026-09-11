# 12 - File & Function Reference

## 1. Backend Core & Services

### `src/server/server.js`
- **Purpose:** Server orchestrator and process lifecycle manager.
- **Key Functions:**
  - `startup()`: Initializes database, checks key migrations, pre-warms live snapshot rows, and starts HTTP server on `PORT`.
  - `gracefulShutdown(signal)`: Closes database pool cleanly and terminates active connections.

### `src/server/app.js`
- **Purpose:** Express application configuration and middleware stack.
- **Responsibilities:** Configures security headers, CORS origin verification, cookie parser, request logging, route mounting for 23 API modules, and SPA static fallback.

### `src/server/db/pool.js`
- **Purpose:** PostgreSQL connection pool and query helpers.
- **Key Functions:**
  - `initDB()`: Creates all 16 database tables, indexes, and initial alert rules.
  - `runKeyMigration()`: Deduplicates legacy rows and re-indexes row keys.
  - `insertRows(rows)`: Chunked batch upsert (500 rows per query) into `velan_rows` using MD5 keys.
  - `saveLiveRows(rows)`: Truncates and populates `velan_live_rows`.
  - `queryRowsPaginated({ limit, offset, search })`: Fast paginated search queries using trigram indexes.
  - `getTotalCount()`: Returns total count of historical archive records.

### `src/server/cache/cacheService.js`
- **Purpose:** Multi-tier Redis caching wrapper with automated error fallback.
- **Key Functions:**
  - `getOrSetCache(key, ttlSeconds, fetchFn)`: Checks Redis first; on cache miss executes `fetchFn()` and stores result.
  - `invalidatePattern(pattern)`: Deletes all Redis keys matching a wildcard pattern (e.g. `dashboard:*`).
  - `getCacheStats()`: Returns hit count, miss count, and cache hit ratio percentage.

### `src/server/services/kpiService.js`
- **Purpose:** Production KPI calculation engine.
- **Key Functions:**
  - `calculateKPIs({ filtered, scGroups, poGroups, todayStr })`: Calculates total items, WIP counts, Inhouse/Vendor breakdown, On-Time Delivery % (OTD), delayed POs list, and daily output trends.

### `src/server/services/bottleneckService.js`
- **Purpose:** Shop-floor bottleneck identification.
- **Key Functions:**
  - `calculateBottlenecks({ poGroups, todayStr, stageCounts, stageCycleTimes, vendorStats })`: Calculates $Queue \times Duration$ score for all stages and ranks top bottlenecks.

### `src/server/services/cycleTimeService.js`
- **Purpose:** Process lead time and stage duration analytics.
- **Key Functions:**
  - `calculateCycleTimes({ filtered, scGroups })`: Calculates stage-to-stage transition times, average stage durations, and average time to reach intermediate stations.

### `src/server/services/vendorService.js`
- **Purpose:** Sub-contractor vendor analytics and SLA compliance.
- **Key Functions:**
  - `calculateVendors({ filtered, todayStr })`: Calculates vendor aging, items pending $>2$ days, SLA violation rates, and vendor efficiency scores.

### `src/server/services/alertEngine.js`
- **Purpose:** Automated shop-floor monitoring and alert dispatch.
- **Key Functions:**
  - `runAlertEngine(rows)`: Evaluates active alert rules (PO delay, vendor SLA, queue backlog) against live records, creates alerts in `alerts` table, and logs to `operational_timeline`.
  - `createAlertIfNew(params)`: Inserts unread alert if duplicate does not already exist, broadcasting over WebSockets.

### `src/server/services/micService.js`
- **Purpose:** Manufacturing Intelligence Center (MIC) metrics.
- **Key Functions:**
  - `calculateMIC({ filtered, scGroups, poGroups, todayStr })`: Calculates Plant Health Index (0–100), weekly/monthly throughput velocity, queue clearance forecasts, predictive delay list, root cause impact, and executive actions.

### `src/server/forecast/slaEngine.js`
- **Purpose:** High-precision predictive SLA forecasting.
- **Key Functions:**
  - `calculateSLAForecast({ liveRows, dbRows })`: Calculates historical PO type velocities, stage weighted throughputs, queue impacts, projected completion dates, and delay probability percentages without double-counting.

---

## 2. Frontend Core & Services

### `src/services/excelParser.js`
- **Purpose:** Multi-format Excel and CSV parser.
- **Key Functions:**
  - `parseWorksheet(ws)`: Dispatches to `parseRowsFromHeaderAoA()`, `parseVelanExcel()`, or `parseGenericRows()`.
  - `parseRawCsv(text)`: Parses CSV text directly to preserve exact date formats without date flipping.
  - `parseVelanExcel(rows)`: Resolves merged PO cells and running PO dates for standard Velan spreadsheets.

### `src/services/dataNormalizer.js`
- **Purpose:** Product classification, stage spell-correction, and timestamp formatting.
- **Key Functions:**
  - `inferType(productName)`: Categorizes products into `APG`, `ARG`, `SPG`, `SRG`, `SP`, or `ACCESSORY`.
  - `normalizeStage(stage)`: Normalizes station names (e.g. `'STORE'` $\to$ `'STORES'`, `'READDY'` $\to$ `'READY'`).
  - `normalizeInhouse(val)`: Standardizes location strings to `'INHOUSE'` or `'VENDOR'`.
  - `normalizeTimestamp(value)`: Converts timestamps to `YYYY-MM-DD HH:MM:SS`.

### `src/services/stageResolver.js`
- **Purpose:** Resolves active manufacturing stage from primary and secondary columns.
- **Key Functions:**
  - `resolveLatestStage({ opStage, status1, status2 })`: Checks `opStage` first; if empty, parses free-text status columns for movement regex (`MOVE TO <STAGE>`) or station acronyms.

### `src/context/DataContext.jsx`
- **Purpose:** Central coordinator for data synchronization and mutations.
- **Key Functions:**
  - `saveRowsToServer(rows, syncType)`: Sends rows to `POST /api/data` via React Query mutation.
  - `syncLiveDataNow(urlOverride)`: Fetches live Google Sheet CSV via `/api/sheets` proxy and triggers save.
  - `importRowsToDb(rows)`: Imports historical rows to database.
  - `resetDBAction()`: Wipes all database rows via `POST /api/reset`.

### `src/hooks/useWebSocket.js`
- **Purpose:** WebSocket client managing auto-reconnect and React Query invalidation.
- **Key Logic:**
  - Connects to `wss://` or `ws://` with exponential backoff (up to 10 retries).
  - Handles incoming events: `sync:completed` (invalidates queries), `alert:created`, `timeline:created`, `system:error`.

### `src/utils/calculationUtils.cjs`
- **Purpose:** Shared working calendar and formula utilities.
- **Key Functions:**
  - `workingDaysBetween(d1Str, d2Str)`: Calculates elapsed working days excluding Sundays and 12 regional company holidays.
  - `getProductCategory(type)`: Maps types to `'AIRPLUG'`, `'MASTER'`, or `'ACCESSORY'`.
  - `isSCComplete(items)`: Returns `true` if all items in an SC set are in a terminal stage.
