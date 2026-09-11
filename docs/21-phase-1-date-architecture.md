# Phase 1 — Date Architecture & Production Projection Implementation
## Velan Metrology Production Dashboard

---

## 1. Executive Summary & Overview

### 1.1 Purpose
This document specifies and records the complete implementation of **Phase 1: Date Architecture & Production Projection** for the **Velan Metrology Production Dashboard**. Phase 1 establishes the canonical data path for product-level projected manufacturing dates (`projectedDate`), aggregates them into Sales Confirmation-level production dates (`scProductionDate`), and provides a clean foundation for estimated commercial delivery lead times (`estimatedDelivery`).

### 1.2 Core Objectives Achieved
1. **Source Date Extraction:** Robust extraction of `PROJECTED DATE` columns from diverse Excel and Google Sheet formats with case-insensitive and multi-alias header mapping.
2. **Canonical Date Normalization:** Converting raw spreadsheet date values (serial dates, ISO strings, Indian/UK `DD/MM/YYYY`, Google Sheets `M/D/YYYY`) into timezone-safe `YYYY-MM-DD` strings.
3. **Database & Schema Ingestion:** Seamless persistence into PostgreSQL `velan_live_rows` and `velan_rows` JSONB storage validated through Zod schema.
4. **Deterministic SC Aggregation:** Calculation of `scProductionDate` defined strictly as $\max(\text{Product Projected Dates})$ across all constituent products in a Sales Confirmation.
5. **Commercial Delivery Separation:** Isolated placeholder calculation for `estimatedDelivery` (~6–8 weeks from PO Date), clearly delineated from shop-floor manufacturing projections.
6. **Frontend Presentation:** Dynamic display of `SC PROD DATE` in the Main SC Table and `PROJECTED DATE` in the Child Product Table on the Sales Confirmation page (`SCPage.jsx`), with graceful fallback handling (`—`).

---

## 2. Source Data Ingestion & Parser Mapping

### 2.1 Supported Column Names & Aliases
In `src/services/excelParser.js`, header detection probes multiple variations of projected date headers:
- `PROJECTED DATE`
- `PROJECTEDDATE`
- `PROJECTED_DATE`
- `PROJECTED DELIVERY DATE`
- `TARGET DATE`
- `TARGET COMPLETION`
- `MFG DUE DATE`
- `MFG DATE`
- `COMPLETION DATE`

### 2.2 Parser Implementation (`src/services/excelParser.js`)
Header scanning occurs across `parseVelanExcel`, `parseGenericRows`, and `parseRowsFromHeaderAoA`. Column indices are resolved via regex matching:
```javascript
const projectedDateIndex = headers.findIndex(
  (h) => /projected\s*date|target\s*completion|mfg\s*due\s*date|target\s*date/i.test(h)
);
```
Values extracted from rows are converted using `formatDate` helper which safely parses Excel numerical date serials (e.g., `45728`), JavaScript Date objects, and textual date strings into ISO `YYYY-MM-DD` strings.

---

## 3. Date Normalization & Validation

### 3.1 Normalizer Pipeline (`src/utils/normalizeRow.js`)
Raw rows pass through `normalizeRow` where `toIsoDateString` converts incoming values into canonical `YYYY-MM-DD` representation:
```javascript
projectedDate: toIsoDateString(raw.projectedDate || raw.projected_date || raw['PROJECTED DATE'] || raw['TARGET DATE'] || raw['MFG DUE DATE']),
```

### 3.2 Timezone-Safe Parsing
To prevent off-by-one errors caused by UTC/Local timezone conversions, dates are parsed component-wise (`year`, `month`, `day`) directly from the string tokens without passing through `new Date(string)` constructors that could trigger midnight UTC offsets.

### 3.3 Zod Upload Schema (`src/server/schemas/upload.schema.js`)
The backend validation schema validates `projectedDate` using the flexible field definition:
```javascript
const rowSchema = z.object({
  // ...
  projectedDate: flexField,
  // ...
});
```

---

## 4. Database Storage & Persistence

### 4.1 Schema-Free JSONB Storage
PostgreSQL storage uses JSONB document columns (`data`) in `velan_live_rows` and `velan_rows`. Because the system stores normalized row objects directly inside JSONB:
- No destructive SQL table migrations or DDL modifications are required.
- `projectedDate` is immediately serialized and persisted alongside all other workpiece attributes (`poNo`, `scNo`, `product`, `currentStage`, `inhouse`).
- Backward compatibility with legacy records is 100% preserved; rows lacking `projectedDate` naturally yield `null` or `undefined` without breaking queries.

### 4.2 Snapshot & History Ingestion (`src/workers/syncWorker.js`)
When new snapshots are ingested from Google Sheets or uploaded Excel files:
1. `velan_live_rows` is updated with the latest live state.
2. `velan_rows` records historical timeline changes keyed by MD5 row hashes.
3. Precedence rules ensure the latest uploaded snapshot becomes the single source of truth for active workpiece projections.

---

## 5. SC Production Date Calculation Engine

### 5.1 Business Rule & Mathematical Definition
A Sales Confirmation (SC) represents a commercial order encompassing one or more physical products (gauges, masters, air plugs, accessories). An SC cannot be marked fully completed or shipped until the **last product** finishes manufacturing.

Therefore, the **SC Production Date** is strictly defined as:
$$\text{SC Production Date} = \max_{p \in \text{SC}} (\text{Projected Date}_p)$$

### 5.2 Implementation (`src/utils/calculationUtils.cjs`)
```javascript
function calculateSCProductionDate(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  const validIsoDates = [];

  for (const item of items) {
    if (!item) continue;
    const rawVal = item.projectedDate || item.projected_date;
    if (!rawVal) continue;
    const s = String(rawVal).trim();
    if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined') continue;

    // 1. Direct match on ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const parts = s.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        validIsoDates.push(s);
        continue;
      }
    }

    // 2. Parse using local date components to avoid timezone shifting
    // ... fallback parser for DD/MM/YYYY and M/D/YY ...
  }

  if (validIsoDates.length === 0) return null;

  validIsoDates.sort();
  return validIsoDates[validIsoDates.length - 1];
}
```

### 5.3 Behavior Scenarios
| Scenario | Input Product Projected Dates | Resulting `scProductionDate` | Notes |
| :--- | :--- | :--- | :--- |
| **All Valid** | `2026-03-10`, `2026-03-25`, `2026-03-15` | `2026-03-25` | Maximum ISO date chosen |
| **Single Item** | `2026-03-15` | `2026-03-15` | Exact single date returned |
| **Mixed Dates** | `2026-03-10`, `null`, `""`, `"—"`, `2026-03-20` | `2026-03-20` | Missing entries safely ignored |
| **All Missing** | `null`, `""`, `"—"` | `null` | Returns `null`, UI renders `—` |
| **Invalid Dates** | `invalid-date`, `not-a-date` | `null` | Malformed strings discarded |
| **Duplicate Dates**| `2026-03-15`, `2026-03-15`, `2026-03-10` | `2026-03-15` | Deterministic maximum |

---

## 6. Estimated Delivery Date Calculation

### 6.1 Purpose & Separation from Shop-Floor Dates
- **Projected Date / SC Production Date:** Technical shop-floor production commitment indicating when machining, sub-contracting, assembly, and inspection will conclude.
- **Estimated Delivery:** Sales/commercial commitment calculated as PO Date + standard manufacturing lead time (~6–8 weeks).

### 6.2 Implementation (`src/utils/calculationUtils.cjs`)
```javascript
function calculateEstimatedDelivery(poDateStr, weeks = 6) {
  if (!poDateStr) return null;
  // Adds 42 calendar days (6 weeks) by default to valid poDate
  // Returns ISO YYYY-MM-DD or null
}
```

### 6.3 Business Verification Status
This formula is tagged with `NEEDS BUSINESS VERIFICATION (BV-03, BV-04)` to confirm whether sales stakeholders require:
- Calendar days (42–56 days) vs working days.
- Fixed 6-week default vs product-type dynamic lead times (e.g., Master Gauges 8 weeks, Air Plugs 4 weeks).

---

## 7. Backend Data Aggregation & API Services

### 7.1 Data Query Service (`src/server/services/dataQueryService.js`)
In `computeGroups(rows)`:
```javascript
const scProductionDate = calculateSCProductionDate(items);
const estimatedDelivery = calculateEstimatedDelivery(poDate, 6);

scGroupMap[scNo] = {
  // ...
  scProductionDate,
  estimatedDelivery,
  // ...
};
```

### 7.2 API Contract & Serialization
Every SC object returned by `/api/groups` and `/api/data` contains:
```json
{
  "scNo": "SC-2026-001",
  "poNo": "PO-9912",
  "poDate": "2026-01-15",
  "scProductionDate": "2026-03-25",
  "estimatedDelivery": "2026-02-26",
  "items": [
    {
      "product": "APG 10-12",
      "projectedDate": "2026-03-10"
    },
    {
      "product": "APG 12-14",
      "projectedDate": "2026-03-25"
    }
  ]
}
```

---

## 8. Frontend Presentation (`SCPage.jsx`)

### 8.1 SC Table Column Addition
On the Sales Confirmation page (`src/pages/SCPage.jsx`):
- **Header:** `SC PROD DATE`
- **Field:** `sc.scProductionDate`
- **Formatting:** `fmtDate(sc.scProductionDate)` with cyan badge styling. If `null`, renders `—`.

### 8.2 Product Details Table Column Addition
When an SC row is expanded to show constituent line items:
- **Header:** `PROJECTED DATE`
- **Field:** `item.projectedDate || item.projected_date`
- **Formatting:** `fmtDate(item.projectedDate)` with muted badge styling. If `null`, renders `—`.

---

## 9. Verification & Testing

### 9.1 Unit Test Coverage (`src/__tests__/utils/calculationUtils.test.js`)
The test suite validates:
1. All valid projected dates returning the true maximum.
2. Single-product SC returning the exact projected date.
3. Mixed valid and null/empty/dash values properly extracting the valid maximum.
4. All missing/null/dash values cleanly returning `null`.
5. Malformed/invalid date strings safely discarded without thrown exceptions.
6. Chronological, reverse-chronological, and random date orderings yielding the identical max date.
7. Duplicate dates processed correctly.
8. `calculateEstimatedDelivery` verifying 6-week and 8-week offset arithmetic.

### 9.2 Test Execution Results
- **Test Runner:** Vitest v4.1.8
- **Files Passed:** 3 / 3 (`calculationUtils.test.js`, `ProtectedRoute.test.jsx`, `ErrorBoundary.test.jsx`)
- **Total Tests Passed:** 28 / 28
- **Vite Production Build:** Successfully compiled with 0 errors.

---

## 10. Business Verification Register

The following items are registered for operational confirmation during future phase deployments:

| ID | Topic | Current Implementation | Proposed Business Question |
| :--- | :--- | :--- | :--- |
| **BV-03** | Estimated Delivery Offset | 6 weeks (42 calendar days) from PO Date | Should Estimated Delivery be 6 weeks, 8 weeks, or product category dependent? |
| **BV-04** | Estimated Delivery Day Type | Calendar days | Should delivery calculation count calendar days or 6-day working days excluding holidays? |
| **BV-05** | SC Prod Date Overrides | Strictly $\max(\text{Product Projected Dates})$ | Can an SC manager manually override the SC-level production date? |
| **BV-06** | Past Due Projections | Retains past date and highlights in UI | Should overdue projected dates automatically roll over or flag as delayed? |
| **BV-07** | Partial Shipments | Single SC production date | If some products in an SC ship early, should the SC date track remaining items only? |
| **BV-08** | Vendor Lead Times | Projected date set by planner | Should vendor stages automatically add SLA buffer to projected dates? |
| **BV-09** | Blank Date Fallback | Displays `—` (dash) | Should products without projected dates assume default lead time or remain blank? |
| **BV-10** | Date Format Standardization | ISO `YYYY-MM-DD` | Is `DD/MM/YYYY` preferred for display in exported PDF/Excel reports? |

---
*Documentation generated as part of Phase 1 implementation for Velan Metrology Production Dashboard.*
