# 05 - End-to-End Data Flow

## 1. Complete Lifecycle Trace

This document maps the complete journey of production data from shop-floor entry to dashboard visualization.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. SOURCE: Google Sheets / Excel Workbook                              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. FETCH & INGESTION                                                   │
│    - File: `src/hooks/useLiveSync.js` or `src/pages/UploadPage.jsx`     │
│    - Function: `fetchDataUrl()` / `handleFileUpload()`                 │
│    - API Call: `GET /api/sheets?url=...` (SSRF-protected proxy)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. PARSING & TOKENIZATION                                              │
│    - File: `src/services/excelParser.js`                               │
│    - Functions: `parseWorksheet()`, `parseRawCsv()`, `parseVelanExcel()`│
│    - Output: Raw array of row objects                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. NORMALIZATION & VALIDATION                                          │
│    - Files: `src/services/dataNormalizer.js`, `stageResolver.js`       │
│    - Functions: `inferType()`, `normalizeStage()`, `toIsoDateString()` │
│    - Schema Validation: `dataUploadSchema` (Zod) in `upload.schema.js` │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. BACKEND INGESTION & QUEUE                                           │
│    - Route: `POST /api/data` or `POST /api/import` in `routes/data.js` │
│    - Queue: `syncQueue.add('sync-data', { incoming, syncType })`       │
│    - Worker: `src/server/workers/syncWorker.js`                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 6. DATABASE PERSISTENCE & ALERTS                                       │
│    - File: `src/server/db/pool.js`                                     │
│    - Execution: `saveLiveRows()` (Snapshot) & `insertRows()` (Archive) │
│    - Alert Engine: `src/server/services/alertEngine.js`                │
│    - Log: `sync_logs` & `operational_timeline`                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 7. CACHE INVALIDATION & WEBSOCKET BROADCAST                            │
│    - Redis: `invalidatePattern('dashboard:*')` in `cacheService.js`    │
│    - WebSocket: `broadcast('sync:completed')` in `websocket.js`       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 8. CLIENT QUERY INVALIDATION & AGGREGATION                             │
│    - Hook: `src/hooks/useWebSocket.js` catches `sync:completed`        │
│    - QueryClient: invalidates `['backendKPIs']`, `['dashboardData']`   │
│    - Hook: `src/hooks/useBackendKPIs.js` queries `/api/dashboard/calc` │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 9. DASHBOARD PRESENTATION & UI                                         │
│    - Components: `KPICard`, `Chart.js`, `VirtualizedTable`             │
│    - Pages: `OverviewPage`, `ManufacturingIntelligencePage`, etc.      │
│    - Final Consumer: Operations Executive & Shop Floor Manager         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stage-by-Stage Detailed Breakdown

### Stage 1: Data Acquisition & SSRF Verification
- **User Action or Timer:** The user clicks "Sync Live" or background timer fires (`useLiveSync.js`).
- **Fetch:** `fetchDataUrl()` in `src/services/sheetsService.js` invokes `GET /api/sheets?url=<encodedUrl>`.
- **Backend Route:** `src/server/routes/sheets.js` validates the target domain against `docs.google.com` or `docs.googleusercontent.com` via `validateSheetsUrl()`.
- **Response:** Raw CSV stream returned to client.

### Stage 2: Client Normalization
- **Parsing:** `parseWorksheet()` or `parseRawCsv()` parses CSV text into row structures.
- **Normalization:** `normalizeRow()` standardizes dates, infers product type (`inferType`), and resolves op stages (`resolveLatestStage`).
- **Dispatch:** `saveRowsToServer()` in `src/context/DataContext.jsx` posts rows to `POST /api/data`.

### Stage 3: Asynchronous Backend Processing (BullMQ Worker)
- **Validation:** `src/server/routes/data.js` validates the incoming JSON against `dataUploadSchema` (Zod).
- **Enqueuing:** A job is added to BullMQ `syncQueue`.
- **Worker Execution (`src/server/workers/syncWorker.js`):**
  1. `saveLiveRows(incoming)`: Replaces all records in `velan_live_rows`.
  2. `insertRows(incoming)`: Executes chunked batch upserts (500 rows per query) into `velan_rows` using MD5 row keys.
  3. `logSync()`: Inserts duration and row counts into `sync_logs`.
  4. `runAlertEngine()`: Queries `alert_rules` and evaluates PO delays, vendor aging, and stage queue backlogs. Inserts any triggered alerts into `alerts` and `operational_timeline`.
  5. `invalidatePattern('dashboard:*')`: Flushes stale Redis calculation caches.
  6. `broadcast('sync:completed')`: Emits real-time notification across all active WebSocket client connections.

### Stage 4: Reactive UI Refetching
- **Client Catch:** `useWebSocket.js` receives `sync:completed`.
- **Cache Invalidation:** React Query invalidates queries matching `['backendKPIs']`, `['productionData']`, and `['dashboardData']`.
- **Calculation Query:** `useBackendKPIs.js` makes a `GET /api/dashboard/calculations` request with active filters.
- **Server Calculation:** Backend `dashboard.js` routes data through `kpiService.js`, `stageService.js`, `cycleTimeService.js`, `vendorService.js`, and `bottleneckService.js`, caching the result in Redis for 300 seconds.
- **Render:** UI widgets, KPI cards, and charts re-render automatically.
