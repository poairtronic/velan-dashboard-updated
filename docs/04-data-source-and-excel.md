# 04 - Data Source & Excel Integration

## 1. Overview of Data Sources

The Velan Dashboard ingests manufacturing job tracking data from two primary channels:
1. **Live Google Sheets (Published Web CSV):** Provides the real-time operational snapshot of jobs currently circulating on the shop floor.
2. **Historical Excel / CSV Spreadsheets (`.xlsx`, `.xls`, `.csv`):** Ingested manually via the *Upload / Import* page to backfill years of historical job logs into the permanent database archive.

---

## 2. Spreadsheet Structure & Layout Types

The parsing engine (`src/services/excelParser.js`) dynamically detects and parses three distinct spreadsheet layouts:

### 2.1 Format 1: Velan Standard Job Card Sheet (Hierarchical / Merged Cells)
In standard Velan shop-floor workbooks:
- **Title Block:** Top 5 rows contain company headers (e.g., `VELAN METROLOGY`, `SNO`, `PO NO`).
- **Merged Cell Hierarchy:** `PO NO` (Column 1) and `PO RECD DATE` (Column 2) are only populated on the first row of an order; subsequent child rows are blank or `NaN` and inherit the running PO value.
- **SC Set Grouping:** `SC NO` (Column 3) defines the multi-component gauge set.
- **Column Mapping:**
  - Column 1: `PO NO` (e.g., `PO-2026-9081`)
  - Column 2: `PO RECD DATE` (e.g., `12/01/2026` or `2026-01-12`)
  - Column 3: `SC NO` (e.g., `SC-4401`)
  - Column 5: `Product Name` / `Description` (e.g., `APG DIA 12.000 MM GO/NOGO`)
  - Column 7: `Status 1` (Current Operation Note / Free text)
  - Column 8: `Status 2` (Next Operation Note / Movement instruction)
  - Column 9: `Inhouse / Vendor` (`INHOUSE` vs `VENDOR`)
  - Column 10: `OP Stage` (Primary station code: `LATHE`, `M1`, `HT`, `CG`, `SG`, `READY`, `STORES`)
  - Column 11: `Timestamp` (Log timestamp: `12/01/2026 14:30:00`)

### 2.2 Format 2: Flat Tabular Spreadsheets (Generic CSV / Excel)
Standard flat exports containing a single header row with recognizable column names. The parser maps aliases dynamically:
- `sc` aliases: `['sc', 'sc no', 'sc#', 'scno']`
- `po` aliases: `['po no', 'pono', 'purchase order', 'purchaseorder']`
- `poDate` aliases: `['po recd date', 'porecddate', 'po date', 'podate', 'date received', 'date']`
- `product` aliases: `['product name', 'productname', 'product', 'item description', 'description']`
- `status1` aliases: `['status 1', 'status1', 'current operation', 'operation']`
- `status2` aliases: `['status 2', 'status2', 'next operation']`
- `inhouse` aliases: `['inhouse/ vendor', 'inhouse/vendor', 'inhousevendor', 'inhouse vendor', 'inhouse', 'location', 'vendor status']`
- `op` aliases: `['op', 'currentstage', 'stage', 'operation stage', 'current operation']`
- `timestamp` aliases: `['timestamp', 'time stamp', 'last updated', 'op time', 'datetime']`

---

## 3. Data Types & Required Fields

| Field Name | Type | Requirement | Description & Allowed Values |
| :--- | :--- | :--- | :--- |
| `sc` | String | **Required** | Sales Confirmation number identifying the complete set (spaces stripped). |
| `po` | String | **Required** | Customer Purchase Order number. |
| `poDate` | ISO Date String (`YYYY-MM-DD`) | **Required for SLA** | Date the PO was formally received by Velan Metrology. |
| `product` | String | **Required** | Detailed description of the manufactured gauge or component. |
| `type` | String | *Auto-inferred* | Inferred product category: `APG`, `ARG`, `SPG`, `SRG`, `SP`, or `ACCESSORY`. |
| `currentStage` | String | **Required** | Active operational stage code (e.g., `LATHE`, `CG`, `HTV`, `READY`, `STORES`). |
| `inhouse` | String | Optional | Location flag: strictly normalized to `'INHOUSE'` or `'VENDOR'`. |
| `status1` | String | Optional | Free-text operational note describing current machining status. |
| `status2` | String | Optional | Free-text operational note describing next scheduled transfer. |
| `timestamp` | ISO String (`YYYY-MM-DD HH:MM:SS`)| Optional | Exact timestamp when the job reached the current stage. |

---

## 4. Normalization & Cleaning Rules

### 4.1 Product Type Inference (`src/services/dataNormalizer.js:inferType`)
```javascript
function inferType(productName) {
  if (!productName) return 'ACCESSORY';
  const p = String(productName).toUpperCase().trim();
  if (p.startsWith('APG') || p.startsWith('2 PAIR APG')) return 'APG';
  if (p.startsWith('ARG')) return 'ARG';
  if (p.startsWith('SRG')) return 'SRG';
  if (p.startsWith('SP ') || p.startsWith('SP\t') || p === 'SP' || /^SP DIA/.test(p)) return 'SP';
  if (p.startsWith('SPG')) return 'SPG';
  return 'ACCESSORY';
}
```

### 4.2 Stage Name Spell-Correction & Aliasing (`src/services/dataNormalizer.js:normalizeStage`)
The normalizer removes whitespace/periods and corrects common operator typos:
- `'STORE'`, `'STORRES'`, `'STOERS'` $\to$ `'STORES'`
- `'READDY'`, `'REAADY'` $\to$ `'READY'`
- `'BLACKENEING'`, `'BLACKNING'`, `'BLACKENNING'` $\to$ `'BLACKENING'`
- `'DCPL'` $\to$ `'DCPLI'`
- Vendor stage suffixes are preserved: `'FBV'`, `'BLV'`, `'SDV'`, `'HOV'`, `'HTV'`, `'HCV'`.

### 4.3 Stage Resolution Fallback (`src/services/stageResolver.js`)
If the dedicated `OP` column is empty, the system analyzes free-text status columns (`status2` then `status1`):
1. Detects movement regex: `MOVE TO ([A-Z0-9]+)` (e.g., `"MOVE TO CG"` $\to$ `'CG'`).
2. Checks keywords: `\bSTOCK\b` $\to$ `'STOCK'`, `\bSTORES?\b` $\to$ `'STORES'`, `\bREADY\b` $\to$ `'READY'`.
3. Scans for known station acronyms (`LATHE`, `M1`, `FB`, `HT`, `CG`, `SG`, `QC`, etc.).

### 4.4 Date & Timestamp Normalization (`src/utils/dateUtils.js`)
- Protects against SheetJS day-month flipping by supporting both `DD/MM/YYYY` (Indian standard) and `M/D/YY` (Google Sheets default).
- Converts all dates into canonical ISO format `YYYY-MM-DD`.
- Extracted time parts are normalized to `YYYY-MM-DD HH:MM:SS`.

---

## 5. Duplicate & Error Handling

- **Deduplication:** When saving to Neon PostgreSQL, rows are deduplicated using the MD5 `row_key`. If an identical row is re-uploaded, PostgreSQL executes an upsert (`ON CONFLICT (row_key) DO UPDATE`), updating `added_at` without inflating record counts.
- **Empty Rows:** Rows where both `sc` and `po` are missing or empty are silently discarded.
- **Missing PO Date:** Rows lacking `poDate` are retained for inventory tracking but excluded from OTD delay calculations.
