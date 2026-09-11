# Phase 6 — Date Data Quality, Validation & Production Hardening
## Velan Metrology Production Dashboard

---

## 1. Executive Summary & Purpose

### 1.1 Purpose
This document establishes the technical specification, validation mechanisms, edge-case hardening, and operational invariants for **Phase 6: Date Data Quality, Validation & Production Hardening** in the **Velan Metrology Production Dashboard**.

The objective of Phase 6 is to protect the live dashboard against malformed, missing, duplicated, out-of-range, or timezone-shifted source dates from Excel/Google Sheets, ensuring that corrupt input cannot silently produce misleading production schedules, break commercial commitments, or crash the application.

---

## 2. The Three Canonical Date Contracts

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
│ • Scope: Individual gauge │ • Scope: Complete SC items   │ • Scope: Customer commercial SLA      │
│ • Type: `YYYY-MM-DD` / `""`│ • Type: `YYYY-MM-DD` / `null`│ • Type: Object with start/end/fmt     │
│ • Formula: Extracted/norm │ • Formula: MAX(valid child)  │ • Formula: PO Date + 42d ... 56d      │
│ • Meaning: Expected shop  │ • Meaning: When the entire   │ • Meaning: Agreed customer delivery   │
│   floor completion date   │   set is ready to ship       │   commitment window (6 to 8 weeks)    │
│ • UI Color: Accent Cyan   │ • UI Color: Accent Cyan      │ • UI Color: Soft Blue (`#60a5fa`)     │
└───────────────────────────┴──────────────────────────────┴───────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Contract Isolation Rules:**
> 1. `SC Production Date` is derived exclusively from the $\max$ of valid child product `projectedDate` values. It is **never** calculated from or influenced by `poDate` or `estimatedDelivery`.
> 2. `Estimated Delivery` is a fixed commercial commitment window calculated as $\text{PO Date} + 42\text{ days (6 weeks)} \dots 56\text{ days (8 weeks)}$. It is **never** influenced by shop-floor `projectedDate` or `scProductionDate`.
> 3. Modifying a child product's projected date updates `SC Production Date` dynamically without changing the commercial `Estimated Delivery`.
> 4. Changing `poDate` adjusts `Estimated Delivery` without affecting individual product or SC production schedules.

---

## 3. Data Quality & Hardening Rules

### 3.1 Input Parsing & Sanitization (`src/utils/dateUtils.js`)
All date inputs passing through `toIsoDateString(value)` undergo strict validation:
1. **Placeholder Filtering:** Values matching `""`, `null`, `undefined`, `" "`, `"—"`, `"-"`, `"null"`, `"undefined"`, `"NaN"`, `"nan"`, `"N/A"`, `"n/a"`, `"TBD"`, `"tbd"`, `"ASAP"`, `"asap"`, `"nil"`, `"NIL"`, `"INVALID"`, or `"invalid"` are normalized to `""` (empty string).
2. **Calendar Boundary Validation:**
   - Year must fall in range $1900 \le \text{Year} \le 9999$.
   - Month must fall in range $1 \le \text{Month} \le 12$.
   - Day must fall in range $1 \le \text{Day} \le 31$.
   - Malformed strings (e.g. `2026-13-45`, `2026-00-00`, `99/99/2026`) are rejected and return `""`.
3. **Indian / Velan Ambiguity Resolution:**
   - Ambiguous slash dates `A/B/YYYY` where $A \le 12$ and $B \le 12$ default to `DD/MM/YYYY` (Velan / Indian standard).
   - Unambiguous dates ($A > 12 \ge B$) are resolved strictly as `DD/MM/YYYY`.
4. **Excel Serial Dates:**
   - Numeric serial numbers in range $20000 \le N \le 80000$ are converted to local calendar dates $(N - 25569) \times 86400000\text{ ms}$.

### 3.2 Timezone-Safe Date Preservation
Date conversions extract local integer tokens (`getFullYear()`, `getMonth() + 1`, `getDate()`) directly. Under no circumstances is `new Date().toISOString()` invoked on local date-only strings, completely preventing UTC midnight date-shifting bugs (e.g., `20/09/2026` shifting to `19/09/2026`).

---

## 4. Edge-Case Matrix & Behavioral Scenarios

| Scenario | Input Child Products | Resulting `scProductionDate` | UI Display | System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **All Valid Dates** | `15/09/2026`, `14/09/2026`, `20/09/2026` | `2026-09-20` | `20/09/2026` | Standard SC 1571 case |
| **Mixed Missing Dates** | `15/09/2026`, `null`, `20/09/2026` | `2026-09-20` | `20/09/2026` | Nulls ignored, latest valid used |
| **Multiple Missing Dates** | `null`, `""`, `20/09/2026` | `2026-09-20` | `20/09/2026` | Partial date sets resolved safely |
| **All Missing Dates** | `null`, `""`, `"—"` | `null` | `—` | Clean fallback, zero NaN/crashes |
| **Invalid Date Text** | `"INVALID"`, `15/09/2026`, `20/09/2026` | `2026-09-20` | `20/09/2026` | Corrupted date skipped safely |
| **All Invalid Dates** | `"INVALID"`, `"TBD"`, `"NaN"` | `null` | `—` | Zero 1970/epoch dates |
| **Historical Duplicate** | Product A hist `15/09`, live `18/09`; Product B `20/09` | `2026-09-20` | `20/09/2026` | Live row overrides historical |
| **SC Boundary Isolation** | SC 1571 (`15/09`, `20/09`), SC 1572 (`30/09`, `05/10`) | SC 1571: `20/09`, SC 1572: `05/10` | Isolated | No date leakage across SCs |

---

## 5. Duplicate Handling & Live-Row Precedence

When multiple rows exist for the same product in an SC:
1. **Live-Row Precedence:** Live rows (`_isLive: true` from `velan_live_rows`) strictly supersede historical database records (`velan_rows`).
2. **Timestamp Tie-Breaking:** If both records have the same live status, the record with the newest ISO timestamp (`r.timestamp > ex.timestamp`) becomes the effective product row.
3. **Effective Item Extraction:** `calculateSCProductionDate` operates strictly on the deduplicated effective items, ensuring historical superseded dates cannot contaminate current production schedules.

---

## 6. Filter & Pagination Invariants

1. **Filter Independence:** In `SCPage.jsx` and `dataQueryService.js`, `scProductionDate` is computed from the full set of items belonging to an SC. If a user filters by stage, type, or product search, the displayed SC Production Date retains the accurate mathematical maximum of the complete SC.
2. **Pagination Independence:** Pagination divides the list of SC sets for display; it never splits or recalculates the internal child product composition of an SC.

---

## 7. Mathematical Invariants & Property Tests

The calculation engine enforces five mathematical invariants:
- **Invariant 1:** $\text{SC Production Date} = \max_{p \in \text{SC, valid}}(\text{Projected Date}_p)$.
- **Invariant 2:** If a child date moves earlier, $\text{SC Production Date}$ remains the same or moves earlier; it **never** moves later unless another child date moved later.
- **Invariant 3:** If a child date moves later and becomes the new maximum, $\text{SC Production Date}$ moves to that later date.
- **Invariant 4:** Changing `poDate` alters `Estimated Delivery` but leaves `scProductionDate` identical.
- **Invariant 5:** Changing `projectedDate` alters `scProductionDate` but leaves `Estimated Delivery` identical.

---

## 8. Complete Step 30 End-to-End Acceptance Test Sequence

```
1. Initial State:
   SC 1571
     ├── Product A: 15/09/2026
     ├── Product B: 14/09/2026
     └── Product C: 20/09/2026
   → SC Production Date = 20/09/2026

2. Dynamic Change:
   Product C: 20/09/2026 → 25/09/2026
   → SC Production Date = 25/09/2026

3. Data Invalidation:
   Product C: 25/09/2026 → "INVALID"
   → SC Production Date = 15/09/2026 (Product A is now latest valid date)

4. Total Absence:
   Product A: null, Product B: "invalid", Product C: null
   → SC Production Date = null (UI renders "—")
```

---

## 9. Automated Test Suite Results

All 66 tests across 3 suites pass with zero failures:
```bash
npx vitest run --pool=threads
# Test Files: 3 passed (3)
# Tests: 66 passed (66)
# Duration: 2.17s
```

### Breakdown of Test Suites:
- `src/__tests__/utils/calculationUtils.test.js` (60 tests):
  - Working days, holidays, SLA thresholds, efficiency (8 tests).
  - Estimated delivery calendar calculations, prompt examples, leap-year rollover (12 tests).
  - SC production date calculation, formatting, null tolerance (14 tests).
  - Phase 5 integration & sorting tests (4 tests).
  - **Phase 6 Date Quality, Timezone Safety, Invariants, and End-to-End Acceptance tests (22 tests).**
- `src/__tests__/components/ProtectedRoute.test.jsx` (5 tests).
- `src/__tests__/integration/ErrorBoundary.test.jsx` (1 test).

---

## 10. Performance & Non-Functional Verification

- **Zero N+1 Queries:** Grouping and date evaluations execute purely in-memory over cached data.
- **Zero Full-Table Scans:** All database operations utilize established GIN trigram and B-Tree index structures.
- **Production Build:** `npm run build` compiled 2277 modules with 0 errors.
