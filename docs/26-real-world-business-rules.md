# 26 - Velan Dashboard Real-World Business Rules & Operational Policies

## 1. Purpose & Rule Taxonomy

This document serves as the formal business rules catalog for the Velan Dashboard. It codifies the operational policies, mathematical formulas, SLA engines, inventory concurrency constraints, and exception-handling logic implemented across the Velan Metrology application.

### 1.1 Rule Taxonomy & Domain Codes
- `BR-PO-*`: Commercial & Purchase Order Rules
- `BR-SC-*`: Sales Confirmation & Job Set Integrity Rules
- `BR-PR-*`: Production Workflow & Workstation Rules
- `BR-VN-*`: Subcontractor & Vendor Logistics Rules
- `BR-CAL-*`: Working Calendar & Shift Schedule Rules
- `BR-INV-*`: Raw Material & Inventory Subsystem Rules
- `BR-FC-*`: Bottleneck & Predictive Forecasting Rules
- `BR-QC-*`: Metrology Quality, Rework & Terminal Release Rules
- `BR-SYNC-*`: Data Ingestion, Deduplication & Sync Conflict Rules

---

## 2. Commercial & Purchase Order Rules (`BR-PO`)

### `BR-PO-001`: 21-Working-Day Delivery SLA Standard
- **Domain:** Commercial / Delivery SLA
- **Trigger / Condition:** Order receipt logged in Column D (`PO RECD DATE`).
- **System Action:** Computes contractual due date as:
  $$\text{Contractual Due Date} = \text{addWorkingDays5Day}(\text{poDate}, 21)$$
- **Business Rationale:** Standard manufacturing lead time for precision plug and ring gauges is 21 working days (3.5 calendar weeks).
- **Code Reference:** [`src/utils/calculationUtils.cjs:TARGET_DAYS`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L5), [`src/server/services/kpiService.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/kpiService.js#L104-L117).
- **Edge Cases:** Orders received on Sundays or company holidays start their 21-day clock on the next active working day.

---

### `BR-PO-002`: Target Date vs. Programmatic SLA Precedence
- **Domain:** Commercial / Ingestion
- **Trigger / Condition:** Column B (`TARGET DATE`) contains a customer-specified delivery date.
- **System Action:** Raw `targetDate` is stored for audit and tabular display, but the automated OTD calculation engine evaluates performance against `poDate + 21 working days`.
- **Business Rationale:** Prevents customer-negotiated early dates from distorting standard shop-floor capacity benchmarks.
- > [!NOTE]
  > **Needs Business Verification:** Confirm whether explicit contract overrides in Column B should supersede the programmatic 21-day calculation for customer-facing OTD metrics.
- **Code Reference:** [`src/services/excelParser.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/excelParser.js).

---

### `BR-PO-003`: Merged Cell PO Inheritance
- **Domain:** Ingestion / Data Integrity
- **Trigger / Condition:** A spreadsheet row has a blank Column C (`PO NO`) but contains child component data (`SC`, `Product Name`).
- **System Action:** Inherits the active `currentPO` from the most recent preceding non-blank row.
- **Business Rationale:** Accommodates visual merged-cell layouts used by shop-floor spreadsheet editors.
- **Code Reference:** [`src/services/excelParser.js:parseVelanExcel`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/excelParser.js#L54-L60).

---

### `BR-PO-004`: PO Completion & OTD Evaluation
- **Domain:** Production Analytics
- **Trigger / Condition:** All constituent items across all child SCs reach a terminal stage (`READY`, `STORES`, `STOCK`, `EXSTOCK`, `DCPLI`, `VA`).
- **System Action:**
  $$\text{PO Status} = \begin{cases} \mathbf{On\text{-}Time}, & \text{workingDaysBetween}(\text{poDate}, \max(\text{timestamp})) \le 21 \\ \mathbf{Delayed}, & \text{workingDaysBetween}(\text{poDate}, \max(\text{timestamp})) > 21 \end{cases}$$
- **Code Reference:** [`src/server/services/kpiService.js:calculateKPIs`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/kpiService.js#L97-L120).

---

## 3. Sales Confirmation & Job Set Rules (`BR-SC`)

### `BR-SC-001`: Strict Matched Set Integrity
- **Domain:** Metrology Assembly / Quality
- **Trigger / Condition:** An SC contains multiple components (e.g. GO Member, NOGO Member, Handle).
- **System Action:** An SC is marked **Complete** if and only if **100% of child components** are in terminal stages.
- **Business Rationale:** Incomplete gauge sets cannot be certified or shipped to customers.
- **Code Reference:** [`src/utils/calculationUtils.cjs:isSCComplete`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L241-L243).

---

### `BR-SC-002`: SC Number Normalization
- **Domain:** Ingestion / Grouping
- **Trigger / Condition:** SC number contains spaces (e.g. `"SC 4401"`, `"SC - 4401"`).
- **System Action:** Strips all spaces and converts to uppercase: `"SC4401"`.
- **Code Reference:** [`src/services/excelParser.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/excelParser.js).

---

### `BR-SC-003`: Truncated Description Matching
- **Domain:** Data Normalization
- **Trigger / Condition:** Product name ends with `'...'` within an SC group.
- **System Action:** Finds the full matching description in the same group and substitutes the truncated string.
- **Code Reference:** [`src/utils/calculationUtils.cjs:normalizeProductsInGroup`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L254-L270).

---

## 4. Workstation & Production Stage Rules (`BR-PR`)

### `BR-PR-001`: 3-Tier Stage Resolution Cascade
- **Domain:** Shop Floor Tracking
- **Trigger / Condition:** Ingesting row status updates.
- **System Action:** Evaluates Column K (`OP`) $\to$ Column I (`STATUS2`) $\to$ Column H (`STATUS1`).
- **Code Reference:** [`src/services/stageResolver.js:resolveLatestStage`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/stageResolver.js#L47-L54).

---

### `BR-PR-002`: Movement Directive Extraction
- **Domain:** Parser / NLP
- **Trigger / Condition:** Free-text status contains pattern `MOVE TO <STAGE>` (e.g., `"MOVE TO CG"`).
- **System Action:** Extracts the target stage and routes the component to that workstation.
- **Code Reference:** [`src/services/stageResolver.js:extractStageFromStatusText`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/stageResolver.js#L10-L11).

---

## 5. Subcontractor & Vendor SLA Rules (`BR-VN`)

### `BR-VN-001`: 2-Day Vendor Aging SLA Limit
- **Domain:** Subcontractor Logistics
- **Trigger / Condition:** An item resides at an external vendor (`inhouse === 'VENDOR'` or stage ends in `'V'`).
- **System Action:** If $\text{workingDaysBetween}(\text{timestamp}, \text{todayStr}) > 2$, flags the item with an immediate **Vendor SLA Violation Alert**.
- **Business Rationale:** Subcontract operations (heat treatment, plating, specialized honing) have an agreed 48-hour turnaround SLA.
- **Code Reference:** [`src/utils/calculationUtils.cjs:isSLAViolation`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L214-L216), [`src/server/services/vendorService.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/vendorService.js).

---

### `BR-VN-002`: Automatic Vendor Tagging on `'V'` Suffix
- **Domain:** Data Normalization
- **Trigger / Condition:** Stage code ends with `'V'` (`FBV`, `BLV`, `HTV`, `HCV`, `HOV`, `SDV`).
- **System Action:** Automatically sets `inhouse = 'VENDOR'` and maps vendor code to stage base name.
- **Code Reference:** [`src/utils/calculationUtils.cjs:getVendorCode`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L233-L239).

---

## 6. Working Calendar & Shift Schedule Rules (`BR-CAL`)

### `BR-CAL-001`: Sunday Exclusion
- **Domain:** Calendar / SLA Engine
- **Trigger / Condition:** Computing working days between two dates.
- **System Action:** Sunday (`getDay() === 0`) is always excluded from working-day counts.
- **Code Reference:** [`src/utils/calculationUtils.cjs:workingDaysBetween`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L97-L106).

---

### `BR-CAL-002`: Tamil Nadu Industrial Holiday Calendar
- **Domain:** Calendar / Statutory Holidays
- **Trigger / Condition:** Any date falling on the 12 official Velan company holidays:
  - `2026-01-01` (New Year's Day)
  - `2026-01-15` (Pongal)
  - `2026-01-16` (Thiruvalluvar Day)
  - `2026-01-17` (Uzhavar Thirunal / Kanum Pongal)
  - `2026-01-26` (Republic Day)
  - `2026-04-14` (Tamil New Year)
  - `2026-05-01` (May Day)
  - `2026-08-15` (Independence Day)
  - `2026-09-14` (Vinayagar Chaturthi)
  - `2026-10-02` (Gandhi Jayanthi)
  - `2026-10-19` (Ayudha Pooja)
  - `2026-11-09` (Diwali)
- **System Action:** Skipped by `workingDaysBetween` and `addWorkingDays5Day`.
- **Code Reference:** [`src/utils/calculationUtils.cjs:COMPANY_HOLIDAYS`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L8-L21).

---

### `BR-CAL-003`: 6-Day Plant vs. 5-Day Forecasting Calibration
- **Domain:** SLA Engine
- **Implementation Note:** 
  - Standard KPI calculation (`workingDaysBetween`) uses a **6-day work week** (Mon–Sat, skipping Sundays & holidays).
  - Forecasting projections (`workingDaysBetween5Day`, `addWorkingDays5Day`) use a **5-day work week** (Mon–Fri, skipping Sat, Sun & holidays) for conservative buffer projection.
- **Code Reference:** [`src/utils/calculationUtils.cjs#L353`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L353).

---

## 7. Raw Material & Inventory Rules (`BR-INV`)

### `BR-INV-001`: Pessimistic Bar Locking on Sawing
- **Domain:** Inventory Concurrency
- **Trigger / Condition:** Operator requests cut operation via `POST /api/inventory/cut-piece`.
- **System Action:** Acquires PostgreSQL pessimistic row lock `SELECT * FROM long_bars WHERE id = $1 FOR UPDATE`.
- **Business Rationale:** Prevents race conditions and physical bar over-allocation during concurrent workshop cuts.
- **Code Reference:** [`src/server/routes/inventory.js#L173-L175`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/routes/inventory.js#L173-L175).

---

### `BR-INV-002`: Long Bar Status Progression
- **Domain:** Inventory
- **Trigger / Condition:** Long bar length reduction after cutting.
- **System Action:**
  $$\text{Status} = \begin{cases} \mathbf{Active}, & \text{currentLength} = \text{originalLength} \\ \mathbf{Partial}, & 0 < \text{currentLength} < \text{originalLength} \\ \mathbf{Depleted}, & \text{currentLength} \le 0 \end{cases}$$
- **Code Reference:** [`src/server/routes/inventory.js#L209-L214`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/routes/inventory.js#L209-L214).

---

### `BR-INV-003`: Fine Blank Stamping Yield & Deduction
- **Domain:** Stamping Workshop
- **Trigger / Condition:** Stamping cut pieces into fine blanks via `POST /api/inventory/fine-blank/produce`.
- **System Action:** Locks cut piece inventory, deducts `consumedQty`, adds `producedQty` to fine blank inventory, and writes audit record to `fine_blank_production_log`.
- **Code Reference:** [`src/server/routes/inventory.js#L381-L454`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/routes/inventory.js#L381-L454).

---

## 8. Bottleneck & Plant Risk Forecasting Rules (`BR-FC`)

### `BR-FC-001`: Inflow / Outflow Velocity Differential
- **Domain:** Predictive Bottleneck Engine
- **Trigger / Condition:** Daily queue analysis across 14 rolling working days.
- **System Action:** Calculates net growth rate per workstation:
  $$\Delta \text{Queue}_{\text{stage}} = \text{Inflow Rate} - \text{Outflow Rate}$$
  Identifies current bottleneck as $\max(\text{Queue Size})$ and projected bottleneck (+14d) as $\max(\text{Queue Size} + 14 \times \Delta \text{Queue})$.
- **Code Reference:** [`src/server/forecast/bottleneckDetection.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/forecast/bottleneckDetection.js).

---

## 9. Deduplication & Sync Conflict Rules (`BR-SYNC`)

### `BR-SYNC-001`: Composite Row Deduplication Key
- **Domain:** Database Sync
- **Trigger / Condition:** Ingesting and merging spreadsheet rows.
- **System Action:** De-duplicates rows across datasets using composite key:
  $$\text{Key} = \text{SC} \parallel \text{PO} \parallel \text{Product} \parallel \text{Stage} \parallel \text{Timestamp}$$
- **Code Reference:** [`src/server/services/dataQueryService.js:getMergedData`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/dataQueryService.js#L43-L56).

---

### `BR-SYNC-002`: Live State vs. Historical Precedence
- **Domain:** Data Query
- **Trigger / Condition:** Row appears in both `velan_live_rows` and `velan_rows`.
- **System Action:** Live row (`_isLive: true`) takes absolute precedence over historical DB rows.
- **Code Reference:** [`src/server/services/dataQueryService.js:computeGroups`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/dataQueryService.js#L154-L160).

---

## 10. Formal `NEEDS BUSINESS VERIFICATION` Register

The following operational assumptions were discovered during code analysis and require explicit business sign-off by Velan Metrology plant management:

| Item # | Verification Subject | Code Location | Observed System Behavior | Proposed Alternative / Question for Management |
| :---: | :--- | :--- | :--- | :--- |
| **BV-01** | **Target Date Override** | [`src/services/excelParser.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/services/excelParser.js) | System enforces $\text{poDate} + 21\text{ working days}$ regardless of Column B (`TARGET DATE`). | Should an earlier customer contractual date in Column B override the 21-day SLA clock? |
| **BV-02** | **Saturday Working Calendar** | [`src/utils/calculationUtils.cjs`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L104) | KPIs treat Saturday as a full working day (6-day plant week), while forecasting treats Saturday as non-working (5-day week). | Is Saturday a standard full shift or half-day across all machining departments? |
| **BV-03** | **Vendor 2-Day Hard SLA** | [`src/server/services/vendorService.js`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/server/services/vendorService.js) | All vendor processes trigger SLA violation after 2 working days. | Do specific vendor processes (e.g. vacuum hardening `HTV`) require a longer SLA (e.g. 4–5 days) than rapid plating (`HCV`)? |
| **BV-04** | **`VA` Terminal Classification** | [`src/utils/calculationUtils.cjs:isSCComplete`](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/src/utils/calculationUtils.cjs#L241-L243) | `VA` (Value Addition / Laser Marking) is included in the terminal completion set for SC completeness. | Should `VA` be considered terminal, or should an SC require `READY` or `STORES` before being marked complete? |

---

## 11. Related Documentation & Cross References

- [21 - Excel / Google Sheet Data Dictionary](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/21-velan-excel-data-dictionary.md) - Field specifications.
- [22 - Production Workflow](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/22-production-workflow.md) - Stage progression and manufacturing operations.
- [23 - PO, SC, and Product Hierarchy](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/23-po-sc-product-hierarchy.md) - Hierarchy aggregation rules.
- [24 - Status & Operation Mapping Dictionary](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/24-status-operation-mapping.md) - Regex parsing and aliases.
- [25 - Dashboard Metric Data Lineage](file:///c:/Users/Admin/OneDrive/Desktop/velan-dashboard-updated/docs/25-dashboard-metric-data-lineage.md) - End-to-end data lineage traces.
