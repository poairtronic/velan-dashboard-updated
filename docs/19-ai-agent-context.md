# 19 - AI Coding Agent Context & Prompting Guide

## 1. Quick Agent Context

If you are an AI coding agent assigned to work on the **Velan Dashboard**, read this document first before writing or modifying any code.

### 1.1 Project Summary
- **App Name:** Velan Metrology Production Command Center
- **Core Stack:** Express 5 (Backend), React 18 + Vite (Frontend), PostgreSQL/Neon (Database), Upstash Redis (Cache), BullMQ (Queue), WebSocket/ws (Real-time).
- **Core Function:** Ingests manufacturing spreadsheet logs from live Google Sheets / Excel, deduplicates rows via MD5 hashing, calculates shop-floor KPIs (OTD %, WIP, Cycle Times, Bottlenecks, SLA forecasts), manages raw material bar cutting, and serves 20 interactive dashboard views.

---

## 2. Key Architecture Locations

| Concept | Primary Implementation File(s) |
| :--- | :--- |
| **Server Bootstrap** | `src/server/server.js`, `src/server/app.js` |
| **Database Pool & Tables**| `src/server/db/pool.js` |
| **Redis Caching Service** | `src/server/cache/cacheService.js`, `src/server/cache/cacheKeys.js` |
| **Background Workers** | `src/server/workers/syncWorker.js`, `exportWorker.js` |
| **Excel / CSV Parsing** | `src/services/excelParser.js`, `src/services/dataNormalizer.js` |
| **Stage Resolution** | `src/services/stageResolver.js` |
| **Working Calendar & Math**| `src/utils/calculationUtils.cjs` |
| **KPI & Analytics Logic** | `src/server/services/kpiService.js`, `bottleneckService.js`, `cycleTimeService.js`, `vendorService.js` |
| **Manufacturing Intelligence**| `src/server/services/micService.js`, `src/server/forecast/` |
| **Cutting Inventory Engine** | `src/server/routes/inventory.js`, `src/pages/InventoryPage.jsx` |
| **Frontend Contexts** | `src/context/AuthContext.jsx`, `DataContext.jsx`, `FilterContext.jsx`, `UIContext.jsx` |
| **Frontend Query Hooks** | `src/hooks/useBackendKPIs.js`, `useProductionDataQuery.js`, `useWebSocket.js` |
| **All Page Views** | `src/pages/` (20 page files) |

---

## 3. "Before Making Any Code Change" Checklist

Before executing any edits:
1. **Never Break Working Day Logic:** All lead-time calculations must use `workingDaysBetween()` from `src/utils/calculationUtils.cjs` (skipping Sundays and 12 regional holidays). Do not use naive calendar date differences `(d2 - d1) / 86400000`.
2. **Never Break MD5 Deduplication:** Rows in `velan_rows` depend on `makeKey()` in `src/server/db/pool.js`. Any modification to key formats must maintain compatibility with existing table unique constraints.
3. **Pessimistic Locking in Inventory Mutations:** Any change to raw bar reductions or fine blank stamping in `src/server/routes/inventory.js` **must** retain `SELECT ... FOR UPDATE` within an active transaction block (`BEGIN ... COMMIT`) to prevent race conditions.
4. **Maintain Zod Schema Compatibility:** If adding new request parameters, update the corresponding schema in `src/server/schemas/` (`upload.schema.js`, `auth.schema.js`, `dashboard.schema.js`, `user.schema.js`).
5. **Run the Test Suite:** Always verify that existing tests pass before concluding your task:
   ```bash
   npm test
   ```

---

## 4. Common Agent Tasks & Exact File Sequences

### Task: Add a New Column from Google Sheets to Dashboard Tables
1. Update `src/services/excelParser.js` to extract the column in `parseRowsFromHeaderAoA()` and `parseGenericRows()`.
2. Update `src/utils/normalizeRow.js` to carry the field into normalized objects.
3. Update `src/server/schemas/upload.schema.js` to allow the field in `rowSchema`.
4. Update `src/components/DataTable.jsx` and `src/components/database/DatabaseTable.jsx` to display the column.

### Task: Add or Modify an Operational Alert Rule
1. Update `src/server/services/alertEngine.js` with the new rule evaluation logic.
2. Update `src/server/db/pool.js` seed data if adding a default rule to `alert_rules`.
3. Test that `createAlertIfNew()` emits `alert:created` over WebSockets.

### Task: Add a New KPI Metric to the Backend & Overview Page
1. Calculate the metric in `src/server/services/kpiService.js:calculateKPIs()`.
2. Add the fallback default in `src/hooks/useBackendKPIs.js:getDefaultKPIs()`.
3. Render the `<KPICard />` in `src/pages/OverviewPage.jsx`.
