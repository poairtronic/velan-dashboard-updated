# Phase 7 — Production Date Analytics & Operational Visibility
## Velan Metrology Production Dashboard

---

## 1. Executive Summary & Purpose

### 1.1 Purpose
This document establishes the technical specification, classification engine, UI integration, mathematical reconciliation guarantees, and test verification for **Phase 7: Production Date Analytics & Operational Visibility** in the **Velan Metrology Production Dashboard**.

Phases 2 through 6 established and hardened the three foundational date contracts:
1. **`projectedDate`**: Product-level manufacturing expected completion date (from Excel/Google Sheets).
2. **`scProductionDate`**: SC-level manufacturing completion date derived as $\max(\text{valid child product projectedDate})$.
3. **`estimatedDelivery`**: Commercial customer-facing delivery window derived from `poDate` (+42..56 calendar days).

Phase 7 introduces an operational visibility and analytics layer on top of these verified dates without altering underlying date formulas or database schemas. It empowers shop-floor supervisors, production managers, and planning teams to immediately identify:
- Which SC sets are **Overdue**
- Which SC sets are **Due Today**
- Which SC sets are **Upcoming** (with granular 7-day and 14-day views)
- Which SC sets have **No Date** assigned
- How production commitments are distributed across time

---

## 2. Architecture & The Analytics Layer

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THREE-TIER DATE CONTRACTS                                        │
├───────────────────────────┬──────────────────────────────┬───────────────────────────────────────┤
│    PROJECTED DATE         │      SC PRODUCTION DATE      │          ESTIMATED DELIVERY           │
├───────────────────────────┼──────────────────────────────┼───────────────────────────────────────┤
│ • Canonical Key:          │ • Canonical Key:             │ • Canonical Key:                      │
│   `projectedDate`         │   `scProductionDate`         │   `estimatedDelivery`                 │
│ • Level: Product / Item   │ • Level: Sales Confirmation  │ • Level: Commercial PO / SC           │
│ • Source: Live Sheet row  │ • Source: Derived dynamically│ • Source: Derived from PO Date        │
│ • Formula: Raw / parsed   │ • Formula: MAX(valid child)  │ • Formula: PO Date + 42d ... 56d      │
│ • Scope: Individual gauge │ • Scope: Complete SC items   │ • Scope: Customer commercial SLA      │
└───────────────────────────┴──────────────────────────────┴───────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 7 PRODUCTION DATE ANALYTICS LAYER                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Classification Engine: `getProductionDateStatus(dateInput, currentDateInput)`                  │
│ • Date Status Codes: `OVERDUE` (#ff3d5a), `DUE_TODAY` (#ffd60a), `UPCOMING` (#00c9ff), `NO_DATE` │
│ • KPI Metric Cards: TOTAL SCs = UPCOMING + DUE TODAY + OVERDUE + NO DATE                         │
│ • Interactive Date Filters: All Dates | Overdue | Due Today | Next 7d | Next 14d | Upcoming | No   │
│ • Visual Distribution Chart: Chart.js bar chart showing SC volume grouped & colored by status   │
│ • Dual-Tier UI Badges: SC Table (`PROD DATE STATUS`) & Product Sub-Table (`DATE STATUS`)         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Phase Boundaries & Non-Interference:**
> 1. Phase 7 is strictly an analytics and operational visibility layer.
> 2. Underlying formulas for `projectedDate`, `scProductionDate` ($\max$), and `estimatedDelivery` (+42..56d) remain completely untouched.
> 3. Estimated Delivery is **never** used to classify production date status.
> 4. Product date status and SC date status remain independent: an individual product may be Overdue while the overall SC set is Upcoming (governed by the latest child product).

---

## 3. Date Status Classification Engine (`src/utils/calculationUtils.cjs`)

### 3.1 Status Classification Logic
The classification engine evaluates dates using canonical date strings (`YYYY-MM-DD`) against a reference date (current date or controlled test date):

| Condition | Status Code | UI Label | Badge Color | CSS Theme | Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| $\text{dateIso} < \text{currentIso}$ | `OVERDUE` | `OVERDUE` | `#ff3d5a` | Crimson Red / Danger | Production date is in the past; requires immediate attention |
| $\text{dateIso} = \text{currentIso}$ | `DUE_TODAY` | `DUE TODAY` | `#ffd60a` | Vibrant Yellow / Warning | Production date is today; scheduled for completion today |
| $\text{dateIso} > \text{currentIso}$ | `UPCOMING` | `UPCOMING` | `#00c9ff` | Accent Cyan / Future | Production date is in the future |
| $\text{dateIso} = \text{""} \lor \text{null} \lor \text{invalid}$ | `NO_DATE` | `NO DATE` | `#7ba7cc` | Muted Gray / Neutral | No valid projected date assigned |

### 3.2 Canonical Implementation
```javascript
function getProductionDateStatus(dateInput, currentDateInput) {
  const dateIso = toIsoDate(dateInput);
  if (!dateIso) {
    return {
      code: 'NO_DATE',
      label: 'NO DATE',
      color: '#7ba7cc',
    };
  }

  const currentIso = currentDateInput ? toIsoDate(currentDateInput) : getTodayIso();
  if (!currentIso) {
    return {
      code: 'NO_DATE',
      label: 'NO DATE',
      color: '#7ba7cc',
    };
  }

  if (dateIso < currentIso) {
    return {
      code: 'OVERDUE',
      label: 'OVERDUE',
      color: '#ff3d5a',
    };
  }
  if (dateIso === currentIso) {
    return {
      code: 'DUE_TODAY',
      label: 'DUE TODAY',
      color: '#ffd60a',
    };
  }
  return {
    code: 'UPCOMING',
    label: 'UPCOMING',
    color: '#00c9ff',
  };
}
```

### 3.3 Next 7 Days and Next 14 Days Range Utilities
Calendar day additions avoid timezone shifts by performing arithmetic directly on local calendar date components:
```javascript
function addCalendarDays(isoDateStr, days) {
  const iso = toIsoDate(isoDateStr);
  if (!iso) return '';
  const parts = iso.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function isDateInNextDays(dateInput, days, currentDateInput) {
  const dateIso = toIsoDate(dateInput);
  if (!dateIso) return false;
  const currentIso = currentDateInput ? toIsoDate(currentDateInput) : getTodayIso();
  if (!currentIso) return false;
  const maxDateIso = addCalendarDays(currentIso, days);
  return dateIso >= currentIso && dateIso <= maxDateIso;
}
```

---

## 4. UI Architecture & Hierarchy in `SCPage.jsx`

### 4.1 Summary Metric KPI Cards
The top of the SC Page renders five high-visibility KPI cards providing instantaneous operational visibility:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    TOTAL SCs     │  │     UPCOMING     │  │    DUE TODAY     │  │     OVERDUE      │  │     NO DATE      │
│       34         │  │        22        │  │        3         │  │        4         │  │        5         │
│  Total SC Sets   │  │ Prod date future │  │ Prod date today  │  │ Passed prod date │  │ Unscheduled SCs  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

> [!TIP]
> **Mathematical Reconciliation Guarantee:**
> $$\text{TOTAL SCs} \equiv \text{UPCOMING} + \text{DUE TODAY} + \text{OVERDUE} + \text{NO DATE}$$
> Every SC belongs to exactly one mutual status category. No double counting or orphan states exist.

### 4.2 Interactive Date Filter Sub-Bar
Users can filter the live SC sets list with single-click interactive pill buttons:
1. **`All Dates`**: Shows all SCs with total count.
2. **`Overdue`**: Filters SCs where `scProductionDate < today`.
3. **`Due Today`**: Filters SCs where `scProductionDate === today`.
4. **`Next 7 Days`**: Filters SCs where `today <= scProductionDate <= today + 7 calendar days`.
5. **`Next 14 Days`**: Filters SCs where `today <= scProductionDate <= today + 14 calendar days`.
6. **`Upcoming`**: Filters SCs where `scProductionDate > today`.
7. **`No Date`**: Filters SCs where `scProductionDate` is null or missing.

### 4.3 Visual Distribution Chart (`distChartRef`)
A responsive Chart.js horizontal bar chart renders the distribution of SCs across production date buckets:
- Grouped by production date string (`DD/MM/YYYY`) and `No Date`.
- Bars are dynamically color-coded:
  - `#ff3d5a` (Crimson) for Overdue dates
  - `#ffd60a` (Yellow) for Due Today
  - `#00c9ff` (Cyan) for Upcoming dates
  - `#7ba7cc` (Gray) for No Date
- Hover tooltips display the exact date, status, and SC count.

### 4.4 Main SC Sets Table Columns
The primary SC table incorporates the full hierarchical column sequence:
1. `SC NO` (Bold cyan link with child count badge)
2. `PO` (Purchase order number)
3. `PO DATE` (Formatted `DD/MM/YYYY`)
4. `ITEMS` (Child product count)
5. `SC PROD DATE` (Formatted `DD/MM/YYYY` or `—`)
6. `PROD DATE STATUS` (Status Badge: `OVERDUE` / `DUE TODAY` / `UPCOMING` / `NO DATE`)
7. `ESTIMATED DELIVERY` (Formatted `DD/MM/YYYY – DD/MM/YYYY`)
8. `LAST TIMESTAMP` (Live scan timestamp)
9. `DAYS TAKEN` (Process cycle days)
10. `SET STATUS` (Production stage badge)

### 4.5 Child Product Details Table Columns
When expanding an SC row, the nested product table displays individual gauge details:
1. `#` (Index)
2. `PRODUCT` (Gauge description)
3. `CURRENT PROCESS` (Current manufacturing stage)
4. `PROJECTED DATE` (Individual product projected date `DD/MM/YYYY` or `—`)
5. `DATE STATUS` (Individual product status badge: `OVERDUE` / `DUE TODAY` / `UPCOMING` / `NO DATE`)
6. `ESTIMATED DELIVERY` (Commercial 6–8 week window)
7. `STATUS 1` (Component/part status)
8. `INHOUSE/VENDOR` (Inhouse or Vendor routing)
9. `LAST UPDATE` (Product-level timestamp)

---

## 5. SC vs Child Product Status Independence

### 5.1 Business Rule
The SC set is only complete when **all** child products are finished. Therefore:
- **`SC Production Date`** $= \max(\text{child product projected dates})$.
- **`SC Production Status`** evaluates the $\max$ date against today.
- **Child Product Status** evaluates each individual product's date against today.

### 5.2 Concrete Example (SC 1571 on 11/09/2026)
Consider SC 1571 with three child products inspected on `11/09/2026`:

| Level | Entity | Projected Date | Comparison vs 11/09/2026 | Computed Status |
| :--- | :--- | :--- | :--- | :--- |
| Child Product | Product A | `10/09/2026` | $10/09 < 11/09$ | **`OVERDUE`** |
| Child Product | Product B | `15/09/2026` | $15/09 > 11/09$ | **`UPCOMING`** |
| Child Product | Product C | `20/09/2026` | $20/09 > 11/09$ | **`UPCOMING`** |
| **SC Level** | **SC 1571 Set** | **`20/09/2026` (MAX)** | $20/09 > 11/09$ | **`UPCOMING`** |

> [!NOTE]
> Even though Product A is overdue, SC 1571 as a whole is scheduled to complete on `20/09/2026` and therefore has an SC status of **`UPCOMING`**. The dashboard displays Product A's overdue badge in the expanded child table, ensuring granular problem identification without corrupting high-level SC metrics.

---

## 6. Backend API Contract (`dataQueryService.js`)

`src/server/services/dataQueryService.js` incorporates `productionDateStatus` directly into the SC group payload:
```javascript
scGroups.push({
  sc,
  po: effectiveItems[0]?.po || null,
  poDate: effectiveItems[0]?.poDate || null,
  items: effectiveItems,
  itemCount: effectiveItems.length,
  scProductionDate,
  productionDateStatus: getProductionDateStatus(scProductionDate).code,
  estimatedDelivery,
  lastTimestamp,
  daysTaken,
  setStatus,
  ...
});
```

---

## 7. Date Transition Lifecycle (Step 28)

For an SC set or product with a production date of `15/09/2026`, the status transitions smoothly across calendar days:

```
Calendar Day:       14/09/2026               15/09/2026               16/09/2026
                      │                         │                         │
Status:            UPCOMING                 DUE TODAY                  OVERDUE
Badge Color:       #00c9ff (Cyan)           #ffd60a (Yellow)          #ff3d5a (Crimson)
Filter Match:   [All, Next 7d, Upcoming]  [All, Due Today, Next 7d]    [All, Overdue]
```

---

## 8. Verification & Test Suite Summary

### 8.1 Automated Test Execution Results
All tests in the Vitest test suite passed with 100% success rate:
- **`src/__tests__/utils/calculationUtils.test.js`**: **75 tests passed**
  - Phase 1 & 2: Base date parsing & projected date extraction
  - Phase 3: Commercial Estimated Delivery window calculation & formatting
  - Phase 4: SC Production Date $\max$ aggregation
  - Phase 5: UI date consistency & 3-tier hierarchy non-interference
  - Phase 6: Data quality sanitization, duplicate resolution, mathematical invariants
  - Phase 7: Date analytics, status classification, transitions, range filters, KPI reconciliation, multi-product SC independence, and full acceptance workflows
- **`src/__tests__/components/ProtectedRoute.test.jsx`**: **5 tests passed**
- **`src/__tests__/integration/ErrorBoundary.test.jsx`**: **1 test passed**
- **Total: 81 tests passing across 3 test suites**

### 8.2 Production Build Verification
- Vite production build executed via `npm run build`
- **Result: 0 errors, 2278 modules transformed in 20.14s**

---

## 9. Phase 8+ Deferred Scope Boundaries

The following features are explicitly deferred to future phases:
- Automated alerts, notifications, and scheduled emails/WhatsApp integration
- Machine learning delay predictions and process time forecasting
- Customer SLA renegotiation workflows
- Database schema alterations or indexing redesigns
