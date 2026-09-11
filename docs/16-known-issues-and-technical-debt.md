# 16 - Known Issues & Technical Debt Analysis

## 1. Overview of Identified Items

This document identifies technical debt, deprecated patterns, and architectural areas requiring future refinement based on full codebase inspection.

---

## 2. Categorized Findings

### 2.1 Confirmed Technical Debt & Legacy Code

1. **Legacy In-Memory State Object (`src/server/state.js`):**
   - *Description:* `src/server/state.js` exports mutable global properties (`_db`, `_liveRows`, `_lastSync`).
   - *Status:* Mostly superseded by PostgreSQL queries (`velan_live_rows`), but `_lastSync` and `_liveRows` are still referenced during server startup and sync workers as an in-memory cache.
   - *Recommendation:* Fully decouple from `state.js` and rely exclusively on PostgreSQL and Redis keys (`keys.DASHBOARD_LIVE`, `keys.SYNC_LOGS`).

2. **Dual Cutting Dashboard Subsystems:**
   - *Description:* The repository contains both a nested NestJS backend (`cutting-dashboard/backend/`) and native Express routes (`src/server/routes/inventory.js`).
   - *Status:* The main React frontend (`src/pages/InventoryPage.jsx`) communicates with the Express routes (`/api/inventory/*`). The `cutting-dashboard/` folder exists as a standalone prototype.
   - *Recommendation:* Archive or document `cutting-dashboard/` as a reference submodule to avoid confusion for future developers.

3. **In-Memory Mock Queue Fallback (`src/server/queues/mockQueueHelper.js`):**
   - *Description:* When `REDIS_URL` is omitted, the system falls back to an in-memory JavaScript queue simulation (`MockQueue`, `MockWorker`).
   - *Status:* Functional for local single-process development, but in-memory jobs will be lost if the server process restarts mid-sync.
   - *Recommendation:* Ensure `REDIS_URL` is always configured in production environments.

---

### 2.2 Potential Issues & Refinements

1. **Unindexed Custom Filter Combinations:**
   - *Description:* Advanced multi-column filters on JSONB properties (e.g. `data->>'type' = 'APG' AND data->>'inhouse' = 'VENDOR'`) rely on GIN indexes or in-memory array filtering.
   - *Recommendation:* For datasets $>200,000$ rows, add specific composite B-tree expression indexes on frequently paired columns:
     ```sql
     CREATE INDEX idx_velan_rows_type_inhouse ON velan_rows ((data->>'type'), (data->>'inhouse'));
     ```

2. **Large Export Payload Memory Usage:**
   - *Description:* Generating 500-page PDF reports in Node.js memory using `jsPDF` creates large Buffer strings converted to base64.
   - *Recommendation:* Use streaming response generation or write temporary PDF files to disk/cloud storage during background export worker execution.

---

### 2.3 Needs Verification Items

1. **Email Notification Dispatcher:**
   - *Observation:* `src/server/services/alertEngine.js` includes a placeholder comment for email alert queue dispatching (`// Send Email Alert (Queue Job)`).
   - *Status:* **Needs Verification** whether SMTP credentials (e.g., SendGrid, Nodemailer) are planned for operational email notifications.
2. **Production Reverse Proxy Protocol Forwarding:**
   - *Observation:* Secure cookie validation and HSTS headers depend on `x-forwarded-proto === 'https'`.
   - *Status:* **Needs Verification** in staging deployment that the load balancer correctly forwards SSL headers.
