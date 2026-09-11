# 21 - Velan Excel / Google Sheet Data Dictionary

## 1. Purpose

This document is the definitive technical and business reference for the raw production tracking spreadsheets (Google Sheets / Excel workbooks) used on the Velan Metrology shop floor. It defines the structural layout, column mappings, data types, normalization behavior, parser logic, and downstream usage across the Velan Dashboard.

---

## 2. Source Workbook Structure

The shop floor operates using shared tracking workbooks (typically published via Google Sheets Web CSV or exported as `.xlsx` / `.csv`).

### 2.1 Workbook Anatomy
- **Workbook Names:** Commonly titled `Velan Production Log`, `Daily Production Status`, `Metrology WIP Tracker`, or `Job Card Master`.
- **Sheet/Tab Names:** Typically `LIVE`, `Current WIP`, `Production Master`, or `Sheet1`.
- **Header Structure:** 
  - Standard workbooks often feature a top title banner (Rows 1–4) containing metadata (e.g., `VELAN METROLOGY`, `JOB CARD PRODUCTION STATUS`).
  - The active column header row is usually located at **Row 1** (for flat CSV exports) or **Row 5 / 6** (for hierarchical job card templates).
- **Data Start Row:** Begins immediately below the detected header row.
- **Merged Cells Pattern:** In hierarchical sheets, `PO NO`, `TARGET DATE`, and `PO RECD DATE` are often populated on the first row of an order group and left blank/merged on subsequent child component rows.
- **Total Columns:** Standard production logs utilize **12 primary columns** (Columns A through L).

---

## 3. Complete Column Dictionary

| Column | Raw Header Aliases | Canonical Field | Data Type | Required? | Business Meaning | Example Value | Used By (System & UI) |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **A** | `SNO`, `S.No`, `Sl.No` | `sno` | Integer / String | No | Serial sequence index of the row. | `1`, `42` | Reference / Display only |
| **B** | `TARGET DATE`, `Target Date`, `Due Date` | `targetDate` | Date String (`DD/MM/YYYY`) | No | Customer contractual target completion date. | `28/02/2026` | Downstream comparison (*Needs Verification*) |
| **C** | `PO NO`, `PO No`, `PONO`, `Purchase Order` | `po` | String (Alphanumeric)| **Yes** | Customer Purchase Order reference code. | `PO-2026-9081`, `PO-4402` | `poGroups`, PO Analysis, OTD KPI, Executive War Room |
| **D** | `PO RECD DATE`, `PO Recd Date`, `PO Date`, `Date Received` | `poDate` | ISO Date (`YYYY-MM-DD`) | **Yes (for SLA)**| Date the order was formally received at the plant. | `12/01/2026` | SLA Engine (21-day clock), Cycle Time, OTD % |
| **E** | `SC`, `SC NO`, `SC#`, `SC No` | `sc` | String (No spaces) | **Yes** | Sales Confirmation number linking gauge sets. | `SC-4401`, `SC4401` | `scGroups`, SC Page, Set Completion calculations |
| **F** | `Product Name`, `Product`, `Item Description` | `product` | String | **Yes** | Component description or gauge specification. | `APG DIA 12.000 MM GO/NOGO` | Product categorization, Type inference, Inventory |
| **G** | `QTY`, `Qty`, `Quantity` | `qty` | Numeric / Integer | No | Batch quantity ordered (defaults to 1 if blank). | `2`, `10` | Volume counting, Capacity planner |
| **H** | `STATUS1`, `Status 1`, `Current Operation` | `status1` | String (Free text) | No | Operator machining notes or operation descriptions. | `TURNING COMPLETED`, `LATHE` | Fallback stage resolver (`stageResolver.js`) |
| **I** | `STATUS2`, `Status 2`, `Next Operation` | `status2` | String (Free text) | No | Next movement instructions or transfer notes. | `MOVE TO CG`, `SENT TO HTV` | Fallback stage resolver (`stageResolver.js`) |
| **J** | `INHOUSE/VENDOR`, `Inhouse/Vendor`, `Location` | `inhouse` | Enum (`'INHOUSE'` \| `'VENDOR'`) | No | Physical manufacturing location flag. | `INHOUSE`, `VENDOR` | Workload split, Vendor Page, Vendor Risk Matrix |
| **K** | `OP`, `Current Stage`, `Stage`, `Operation Stage` | `currentStage` | String (Normalized Code)| **Yes** | Active manufacturing process station code. | `LATHE`, `M1`, `HTV`, `CG`, `READY` | Stage counts, Bottlenecks, Plant Health, WIP |
| **L** | `OP UPDATED DATE`, `Timestamp`, `Last Updated`, `OP Time` | `timestamp` | ISO Datetime (`YYYY-MM-DD HH:MM:SS`)| Optional | Date and time the current operation was logged. | `2026-01-14 15:30:00` | Process Aging, Vendor Aging (>2d SLA), Cycle Time |

---

## 4. Field-by-Field Detailed Technical Specification

### Column A: `SNO` (Serial Number)
- **Business Meaning:** Line item row counter in the spreadsheet.
- **Handling:** Ignored during backend deduplication; used only for tabular row indexing.

### Column B: `TARGET DATE`
- **Business Meaning:** Customer-requested deadline recorded when the order was entered.
- **Parser & Application Behavior:** Extracted if present.
- **Relationship to 21-Day SLA Target:** *Documentation Discrepancy & Verification Note:* The application's automated SLA Engine computes delivery deadlines as $\text{poDate} + 21 \text{ working days}$. The static spreadsheet `TARGET DATE` is preserved in raw objects but is currently secondary to the programmatic 21-working-day target calculated from Column D (`PO RECD DATE`). *(Needs Business Verification for customer contract overrides).*

### Column C: `PO NO` (Purchase Order Number)
- **Business Meaning:** Unique commercial order reference issued by the customer.
- **Hierarchy Role:** Top parent container in the manufacturing hierarchy.
- **Parser Logic (`src/services/excelParser.js:parseVelanExcel`):** Merged cell propagation: if Column C is blank on child rows, it retains the running `currentPO` from the previous row.
- **Database Storage:** Stored in `velan_rows.data->>'po'` with trigram GIN index `idx_velan_rows_po`.

### Column D: `PO RECD DATE` (PO Received Date)
- **Business Meaning:** The official start date for plant lead time and SLA measurement.
- **Formatting:** Normalized by `toIsoDateString()` from `DD/MM/YYYY`, `MM/DD/YYYY`, or `YYYY-MM-DD` into standard `YYYY-MM-DD`.
- **Calculations Dependent on Field:**
  - `workingDaysBetween(poDate, todayStr)` $\to$ Current PO Age.
  - `workingDaysBetween(poDate, timestamp)` $\to$ Completed PO Lead Time.
  - On-Time Delivery % (OTD %): POs completed where $\text{Lead Time} \le 21$ working days.

### Column E: `SC` (Sales Confirmation Number)
- **Business Meaning:** Internal Velan order set number. Precision gauges are frequently manufactured in matched sets (e.g., GO gauge + NO-GO gauge + Setting Plug).
- **Parser Normalization:** All whitespace is stripped (e.g., `'SC 4401'` $\to$ `'SC-4401'`).
- **Hierarchy Role:** Child of PO, parent of multiple Product rows.

### Column F: `Product Name` (Product Description)
- **Business Meaning:** Full technical description of the manufactured gauge or accessory.
- **Parser & Type Inference (`src/services/dataNormalizer.js:inferType`):**
  - Starts with `APG` or `2 PAIR APG` $\to$ `'APG'` (Air Plug Gauge)
  - Starts with `ARG` $\to$ `'ARG'` (Air Ring Gauge)
  - Starts with `SRG` $\to$ `'SRG'` (Setting Ring Gauge)
  - Starts with `SP`, `SP DIA`, `SP\t` $\to$ `'SP'` (Setting Plug)
  - Starts with `SPG` $\to$ `'SPG'` (Standard Plug Gauge)
  - Other strings $\to$ `'ACCESSORY'`

### Column G: `QTY` (Quantity)
- **Business Meaning:** Batch quantity for the specific item row.
- **Handling:** Stored in `data->>'qty'`. If omitted or null, defaults to 1 during calculation aggregations.

### Columns H & I: `STATUS1` & `STATUS2` (Operation Notes & Movement)
- **Business Meaning:** Free-text descriptions entered by machinists or quality control inspectors.
- **Usage in Stage Resolver (`src/services/stageResolver.js`):**
  - If Column K (`OP`) is blank, `resolveLatestStage()` scans `STATUS2` then `STATUS1` using regex `MOVE TO ([A-Z0-9]+)` to automatically deduce the active stage.

### Column J: `INHOUSE/VENDOR` (Location Indicator)
- **Business Meaning:** Denotes whether machining is taking place inside the Velan facility or at a third-party sub-contractor.
- **Normalization (`src/services/dataNormalizer.js:normalizeInhouse`):**
  - If string contains `'VENDOR'` $\to$ `'VENDOR'`
  - Otherwise $\to$ `'INHOUSE'` (default)

### Column K: `OP` (Operation Stage Code)
- **Business Meaning:** The authoritative manufacturing workstation code where the job is currently located.
- **Standard Inhouse Stages:** `LATHE`, `M1` (Milling), `FB` (Fine Blanking), `HT` (Heat Treatment), `SZ` (Sizing), `BLK` (Blackening), `CG` (Cylindrical Grinding), `SG` (Surface Grinding), `SD` (Sub-contract Drill), `HO` (Honing), `CA` (Calibration), `WC` (Wire Cut), `VA` (Visual Inspection/Assembly), `QC` (Quality Control), `DCPLI` (Deep Cryogenic Treatment).
- **Vendor Sub-Contract Stages (Ending in 'V'):** `FBV`, `BLV`, `SDV`, `HOV`, `HTV`, `HCV`.
- **Terminal Stages:** `READY`, `STORES`, `STOCK`, `EXSTOCK`, `VA`.

### Column L: `OP UPDATED DATE` (Timestamp)
- **Business Meaning:** Exact date and time the job entered its current operation.
- **Normalization (`src/services/dataNormalizer.js:normalizeTimestamp`):** Standardized to `YYYY-MM-DD HH:MM:SS`.
- **Aging Calculations:**
  - Inhouse Process Cycle Time: $\text{Timestamp} - \text{PO Date}$.
  - Vendor Aging (SLA): $\text{Today} - \text{Timestamp}$. If $>2$ working days at vendor $\to$ **SLA Violation**.

---

## 5. Excel Hierarchy Model

```
Purchase Order (PO NO)           [e.g., PO-2026-9081 | PO Date: 12/01/2026]
 └── Sales Confirmation (SC NO)   [e.g., SC-4401]
      ├── Product 1 (GO Member)   [APG DIA 12.000 MM GO | Stage: LATHE | Timestamp: 14/01/2026]
      └── Product 2 (NO-GO Member)[APG DIA 12.000 MM NOGO | Stage: CG    | Timestamp: 15/01/2026]
```

---

## 6. End-to-End Column Transformation Lineage

```
Excel Column K (OP: "STORE ")
   │
   ▼ (src/services/excelParser.js)
Raw Property { opStage: "STORE " }
   │
   ▼ (src/services/dataNormalizer.js:normalizeStage)
Normalized Property { currentStage: "STORES" }
   │
   ▼ (src/server/routes/data.js -> src/server/db/pool.js)
PostgreSQL velan_rows (data->>'currentStage' = "STORES")
   │
   ▼ (src/server/services/kpiService.js:calculateKPIs)
Aggregated Output: kpis.stores = count(STORES)
   │
   ▼ (src/server/routes/dashboard.js -> GET /api/dashboard/calculations)
JSON Payload: { stores: 42, ready: 18, wip: 156 }
   │
   ▼ (src/hooks/useBackendKPIs.js -> src/pages/OverviewPage.jsx)
Rendered UI: <KPICard title="Stores" value="42" />
```

---

## 7. Data Quality & Exception Handling Rules

1. **Merged Cell Blank Propagation:** Blank PO numbers inherit the most recent preceding non-blank PO number.
2. **Invalid / Unparseable Dates:** If a date string cannot be parsed into `YYYY-MM-DD`, it is set to `null`. The record is stored for inventory purposes but excluded from time-difference equations.
3. **Typo Correction Dictionary:** Common shop-floor misspellings (e.g. `'CALIBARTION'`, `'BLACKNING'`, `'READDY'`) are automatically replaced by canonical stage names.
4. **Missing Stage Fallback:** If `OP` is blank, stage resolution falls back to `STATUS2` $\to$ `STATUS1` $\to$ `''`.

---

## Related Documentation
- [Production Workflow](./22-production-workflow.md)
- [PO-SC-Product Hierarchy](./23-po-sc-product-hierarchy.md)
- [Status & Operation Mapping](./24-status-operation-mapping.md)
- [Dashboard Metric Data Lineage](./25-dashboard-metric-data-lineage.md)
- [Real-World Business Rules](./26-real-world-business-rules.md)
