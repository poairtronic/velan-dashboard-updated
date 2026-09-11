# 15 - Performance & Scalability Analysis

## 1. Performance Architecture & Benchmarks

The Velan Dashboard is designed to handle **100,000+ historical records** and **50+ concurrent plant users** while maintaining sub-100ms API response latencies.

---

## 2. Implemented Performance Optimizations

### 2.1 Database Indexing & Fast Full-Text Search
- **GIN Trigram Indexes (`pg_trgm`):**
  ```sql
  CREATE INDEX idx_velan_rows_sc ON velan_rows USING GIN ((data->>'sc') gin_trgm_ops);
  CREATE INDEX idx_velan_rows_po ON velan_rows USING GIN ((data->>'po') gin_trgm_ops);
  CREATE INDEX idx_velan_rows_prod ON velan_rows USING GIN ((data->>'product') gin_trgm_ops);
  CREATE INDEX idx_velan_rows_stage ON velan_rows USING GIN ((data->>'currentStage') gin_trgm_ops);
  ```
  Enables instant fuzzy substring searches (`WHERE data->>'sc' ILIKE '%4401%'`) on huge datasets without sequential full-table scans.

### 2.2 Server-Side Pagination
- The database exploration table (`DatabasePage.jsx`) and production table (`ProductionPage.jsx`) request paginated chunks (`limit=100`, `offset=0`) via `GET /api/data/production` rather than loading all 100,000 records into browser memory at once.

### 2.3 Virtualized DOM Rendering (`react-window`)
- `src/components/ui/VirtualizedTable.jsx` utilizes `FixedSizeList` from `react-window` to render only the visible table rows in the browser DOM viewport (~20 rows rendered at a time), eliminating DOM lag when scrolling large lists.

### 2.4 Multi-Tier Caching Pipeline
1. **Upstash Redis Caching (`cacheService.js`):**
   - Pre-aggregates calculations for `/api/dashboard/calculations` and caches the result for 300 seconds.
   - Distinct filter combinations are hashed into discrete Redis keys (`dashboard:kpis:<hash>`).
2. **React Query Browser Caching:**
   - Caches API responses on the client with a 60-second `staleTime`.
   - Reuses previous data during filter transitions (`keepPreviousData: true`) to prevent UI flickering.

### 2.5 In-Memory Calculation Memoization
- `src/utils/calculationUtils.cjs` maintains an in-memory LRU map (`workingDaysCache`) for `workingDaysBetween(d1, d2)`, preventing duplicate date parsing across thousands of row iterations.

### 2.6 Asynchronous Background Workers
- Heavy tasks (bulk database synchronization and multi-page PDF generation) are offloaded to BullMQ background workers (`syncWorker.js`, `exportWorker.js`), ensuring the Express HTTP server thread remains free to handle incoming user requests.

---

## 3. Potential Bottlenecks & Scaling Recommendations

1. **Large Live Snapshot Merging (`dataQueryService.js:getMergedData`):**
   - *Observation:* When querying the entire historical database, `getMergedData()` loads `velan_live_rows` and `velan_rows` into Node memory and computes union sets.
   - *Recommendation for >500k rows:* Migrate the deduplication union and working-day differences to a PostgreSQL stored procedure or materialized view (`velan_active_snapshot_mv`) refreshed upon sync completion.
2. **Redis Memory Capacity:**
   - *Observation:* PDF and CSV export files are cached in Redis with base64 strings (`export:<jobId>`) for 1 hour.
   - *Recommendation:* If generating thousands of reports daily, stream large report files directly to cloud object storage (e.g. AWS S3 or Cloudflare R2) and store only pre-signed URLs in Redis.
