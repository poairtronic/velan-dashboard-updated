# 25 - Dashboard Metric Data Lineage & End-to-End Traceability Matrix

## 1. Purpose & Architecture Overview

This document provides the end-to-end data lineage for every key performance indicator (KPI), operational chart, bottleneck alert, and inventory metric displayed across the **Velan Dashboard**. It traces data transformations step-by-step from raw spreadsheet cells to final UI render trees.

---

## 2. Data Lineage Flow Architecture

```mermaid
flowchart TD
    subgraph Ingestion ["1. Source & Normalization"]
        XL["Excel / Google Sheet<br/>(Columns A–L)"]
        Parser["excelParser.js & dataNormalizer.js<br/>• Typo correction<br/>• Stage resolution<br/>• ISO Date formatting"]
        XL --> Parser
    end

    subgraph Storage ["2. Database Layer (Postgres / Neon)"]
        LiveDB[("velan_live_rows<br/>(data JSONB)")]
        HistDB[("velan_rows<br/>(data JSONB + MD5 dedup)")]
        InvDB[("Inventory Tables<br/>(long_bars, cut_pieces, fine_blanks)")]
        Parser --> LiveDB
        Parser --> HistDB
    end

    subgraph Calculation ["3. Server Calculation Services"]
        KPISvc["kpiService.js<br/>(OTD %, WIP, Outputs)"]
        StageSvc["stageService.js<br/>(WIP by Stage, Aging)"]
        VendorSvc["vendorService.js<br/>(Vendor 2-day SLA Aging)"]
        BottleSvc["bottleneckService.js<br/>(Inflow/Outflow Queues)"]
        MICSvc["micService.js<br/>(Intake vs Closure Intelligence)"]
        
        LiveDB --> KPISvc & StageSvc & VendorSvc & BottleSvc & MICSvc
        HistDB --> KPISvc & StageSvc & VendorSvc & BottleSvc & MICSvc
    end

    subgraph API ["4. REST API Routing & Caching"]
        Cache["Redis / In-Memory Cache<br/>(getOrSetCache, TTL: 60–300s)"]
        Routes["/api/dashboard/calculations<br/>/api/dashboard/kpis<br/>/api/forecast/bottlenecks<br/>/api/mic/overview<br/>/api/inventory/stock"]
        KPISvc & StageSvc & VendorSvc & BottleSvc & MICSvc --> Cache --> Routes
        InvDB --> Routes
    end

    subgraph Frontend ["5. State, Hooks & UI Cards"]
        ReactQuery["useQuery / useBackendKPIs / DataContext"]
        UI["Executive War Room<br/>Plant Health KPI Cards<br/>Vendor Risk Matrix<br/>Bottleneck Forecast Panel<br/>Inventory Manager"]
        Routes --> ReactQuery --> UI
    end

    classDef src fill:#0fa8e0,stroke:#004b75,color:#fff;
    classDef db fill:#ffd60a,stroke:#8c7600,color:#000;
    classDef calc fill:#ff6b35,stroke:#8c2700,color:#fff;
    classDef ui fill:#00e676,stroke:#005b22,color:#000;

    class XL,Parser src;
    class LiveDB,HistDB,InvDB db;
    class KPISvc,StageSvc,VendorSvc,BottleSvc,MICSvc calc;
    class UI ui;
```

---

## 3. Master Lineage Traceability Matrix

| Metric Name | Source Excel Column(s) | Normalized Field(s) | DB Path (`velan_rows`) | Calculation Logic / Function | REST Endpoint & JSON Path | Frontend Hook / Context | Target UI Component & Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Time Delivery (OTD %)** | Col D (`PO RECD DATE`), Col L (`OP UPDATED DATE`), Col K (`OP`) | `poDate`, `timestamp`, `currentStage` | `data->>'poDate'`, `data->>'timestamp'`, `data->>'currentStage'` | $\frac{\text{onTimePOs}}{\text{completedPOCount}} \times 100$<br/>`kpiService.js:calculateKPIs` | `GET /api/dashboard/kpis`<br/>`res.onTimePct` | `useBackendKPIs`<br/>`kpis.onTimePct` | `<KPICard title="On-Time Delivery"/>`<br/>`Executive.jsx`, `Dashboard.jsx` |
| **Total Plant WIP** | Col K (`OP`), Col H (`STATUS1`), Col I (`STATUS2`) | `currentStage` | `data->>'currentStage'` | Count of rows where `currentStage` $\notin \text{Terminal Set}$<br/>`kpiService.js` | `GET /api/dashboard/kpis`<br/>`res.wip` | `useBackendKPIs`<br/>`kpis.wip` | `<KPICard title="Total WIP"/>`<br/>`Dashboard.jsx`, `ProductionMetrics.jsx` |
| **WIP by Stage** | Col K (`OP`) | `currentStage` | `data->>'currentStage'` | Aggregated count per stage key<br/>`stageService.js:calculateStages` | `GET /api/dashboard/stages`<br/>`res.stageWIP` | `useBackendKPIs`<br/>`kpis.stageWIP` | `<StageDistributionChart/>`<br/>`ProductionMetrics.jsx` |
| **Vendor SLA Violations (>2 Days)** | Col J (`INHOUSE/VENDOR`), Col K (`OP`), Col L (`TIMESTAMP`) | `inhouse`, `currentStage`, `timestamp` | `data->>'inhouse'`, `data->>'currentStage'`, `data->>'timestamp'` | `workingDaysBetween(timestamp, todayStr) > 2`<br/>`vendorService.js:calculateVendors` | `GET /api/dashboard/vendors`<br/>`res.vendorDelayedCount` | `useBackendKPIs`<br/>`kpis.vendorDelayedCount` | `<VendorBottleneckAlert/>`<br/>`VendorPage.jsx`, `Dashboard.jsx` |
| **Bottleneck Stage Identification** | Col K (`OP`), Col L (`TIMESTAMP`) | `currentStage`, `timestamp` | `data->>'currentStage'`, `data->>'timestamp'` | Current queue size + Inflow/Outflow velocity differential<br/>`bottleneckDetection.js` | `GET /api/forecast/bottlenecks`<br/>`res.currentBottleneck` | `useForecastQuery`<br/>`forecast.currentBottleneck` | `<BottleneckForecast/>`<br/>`ForecastingPage.jsx` |
| **Monthly Intake & Closure (MIC)** | Col D (`PO RECD DATE`), Col L (`TIMESTAMP`), Col K (`OP`) | `poDate`, `timestamp`, `currentStage` | `data->>'poDate'`, `data->>'timestamp'`, `data->>'currentStage'` | 30d/60d historical intake vs terminal completions<br/>`micService.js:calculateMIC` | `GET /api/mic/overview`<br/>`res.intakeVsClosure` | `useMICQuery`<br/>`mic.intakeVsClosure` | `<MICDashboard/>`<br/>`MICPage.jsx` |
| **SC (Set) Completion Count** | Col E (`SC`), Col K (`OP`) | `sc`, `currentStage` | `data->>'sc'`, `data->>'currentStage'` | `isSCComplete(sc.items)` ($\forall item \in \text{Terminal}$)<br/>`kpiService.js` | `GET /api/dashboard/kpis`<br/>`res.completeSets` | `useBackendKPIs`<br/>`kpis.completeSets` | `<SCStatusTable/>`<br/>`SCStatusPage.jsx` |
| **PO Cycle Time (Days)** | Col D (`PO RECD DATE`), Col L (`TIMESTAMP`) | `poDate`, `timestamp` | `data->>'poDate'`, `data->>'timestamp'` | $\text{workingDaysBetween}(\text{poDate}, \max(\text{timestamp}))$<br/>`cycleTimeService.js` | `GET /api/dashboard/cycle-times`<br/>`res.avgPOCycleTime` | `useBackendKPIs`<br/>`kpis.avgPOCycleTime` | `<CycleTimeCard/>`<br/>`Executive.jsx` |
| **Cut Piece Raw Inventory** | Cut piece logs | `cutDimension`, `quantityAvailable` | `cut_piece_inventory.quantity_available` | Atomic sum of available billets post-sawing<br/>`inventory.js:GET /stock` | `GET /api/inventory/stock`<br/>`res[].quantityAvailable` | `useInventoryQuery` | `<CutPieceTable/>`<br/>`InventoryPage.jsx` |
| **Fine Blank Stock** | Stamping logs | `fineBlankName`, `quantityAvailable` | `fine_blank_inventory.quantity_available` | Atomic inventory balance post-hydraulic press<br/>`inventory.js:GET /fine-blank-stock` | `GET /api/inventory/fine-blank-stock`<br/>`res[].quantityAvailable` | `useInventoryQuery` | `<FineBlankStockPanel/>`<br/>`InventoryPage.jsx` |

---

## 4. Deep-Dive Lineage Traces

### 4.1 On-Time Delivery (OTD %) Lineage
1. **Source Extraction:** `excelParser.js` ingests Column D (`PO RECD DATE`) and Column L (`OP UPDATED DATE`).
2. **Normalization:** `dataNormalizer.js` converts dates to ISO format (`YYYY-MM-DD`).
3. **Database Retrieval:** `dataQueryService.js:computeGroups` groups rows into `poGroups`.
4. **Business Calculation ([`src/server/services/kpiService.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/kpiService.js#L97-L120)):
   - Checks if every component in `pg.items` has a stage in `['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA']`.
   - If complete: $\text{days} = \text{workingDaysBetween}(\text{poDate}, \max(\text{items.timestamp}))$.
   - If $\text{days} \le 21$, increment `onTime`. Otherwise increment `delayed`.
   - Computes: $\text{onTimePct} = \text{round}\left(\frac{\text{onTime}}{\text{completedPOCount}} \times 100\right)$.
5. **API Response:** Transmitted via `GET /api/dashboard/kpis` $\to$ `{ onTimePct: 88, onTime: 44, delayed: 6 }`.
6. **Frontend Store:** Cached by TanStack Query under query key `['backendKPIs', filters]`.
7. **UI Render:** Rendered in `<KPICard title="On-Time Delivery" value="88%" status="success"/>` on the **Executive Dashboard**.

---

### 4.2 Vendor Aging (>2 Days SLA) Lineage
1. **Source Extraction:** Column J (`INHOUSE/VENDOR`) and Column K (`OP`).
2. **Stage Mapping:** Normalized by `stageResolver.js` (e.g., `HTV` or `inhouse = 'VENDOR'`).
3. **Aging Computation ([`src/server/services/vendorService.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/vendorService.js)):
   - Filters rows where `inhouse === 'VENDOR' || stage.endsWith('V')`.
   - Computes: $\text{agingDays} = \text{workingDaysBetween}(\text{row.timestamp}, \text{todayStr})$.
   - Flags row if $\text{agingDays} > 2$.
4. **API Response:** `GET /api/dashboard/vendors` returns `vendorStats`, `vendorDelayedCount`, and `delayedVendorItems`.
5. **UI Render:** Rendered in `<VendorBottleneckAlert count={vendorDelayedCount}/>` and `<VendorRiskMatrix/>`.

---

### 4.3 Inventory ACID Raw Cutting Lineage
1. **Operator Action:** User enters cut command (e.g. cut 5 billets of 120mm from 3000mm Bar #12).
2. **Backend Transaction ([`src/server/routes/inventory.js:POST /cut-piece`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/routes/inventory.js#L161-L260)):
   - Starts SQL `BEGIN` transaction.
   - Executes `SELECT * FROM long_bars WHERE id = $1 FOR UPDATE` (Pessimistic Write Lock).
   - Validates length: $\text{currentLength} \ge \text{cutDimension} \times \text{quantity}$.
   - Updates `long_bars.current_length = current_length - totalReduction`.
   - Increments `cut_piece_inventory.quantity_available += quantity`.
   - Appends audit entry into `production_log`.
   - Commits with `COMMIT`.
3. **Frontend Invalidation:** `useMutation` triggers `queryClient.invalidateQueries(['inventoryStock'])`.
4. **UI Render:** Instantly updates stock counts in `<CutPieceInventoryTable/>`.

---

## 5. Data Freshness & Cache Lineage

To support sub-second dashboard rendering across 100,000+ historical rows, calculation services employ multi-layered caching:

```mermaid
graph LR
    Req["Frontend KPI Request"] --> CacheCheck{"Cache Hit in Redis / Memory?"}
    CacheCheck -- "YES (Age < TTL)" --> RetFast["Instant Return (0–5ms) + _meta.freshness"]
    CacheCheck -- "NO / Invalidated" --> QueryDB["Run Postgres DB Query & Calculations"]
    QueryDB --> SetCache["Store in Cache (TTL: 60–300s)"]
    SetCache --> RetFresh["Return Fresh Payload"]
```

- **Short Cache (TTL = 60s):** Raw merged database tables (`all_merged_db_data`, `merged_data_YYYY-MM-DD`).
- **Standard Cache (TTL = 300s):** Calculated KPI overviews, stage WIP, vendor risk, and forecasting projections.
- **Cache Invalidation Triggers:** Any new spreadsheet upload (`saveRows`), manual Google Sheets sync, or DB import explicitly invalidates relevant query keys.

---

## 6. Related Documentation & Cross References

- [21 - Excel / Google Sheet Data Dictionary](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/21-velan-excel-data-dictionary.md) - Input column mappings.
- [22 - Production Workflow](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/22-production-workflow.md) - Workstation lifecycle and stage aging.
- [23 - PO, SC, and Product Hierarchy](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/23-po-sc-product-hierarchy.md) - SC and PO grouping graphs.
- [24 - Status & Operation Mapping Dictionary](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/24-status-operation-mapping.md) - Regex parsing and typo maps.
- [26 - Real-World Business Rules](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/26-real-world-business-rules.md) - Structured catalog of manufacturing business rules.
