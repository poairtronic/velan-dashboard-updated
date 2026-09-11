# 17 - Change Impact Map

## 1. Purpose

This guide outlines the exact downstream files, functions, and components affected when making common modifications to the codebase.

---

## 2. Common Change Scenarios

### 2.1 Scenario: Adding or Renaming a Spreadsheet Column
*Example: Adding a `BATCH_NO` column to shop-floor spreadsheets.*

```
1. EXCEL PARSER:
   └── Modify `src/services/excelParser.js`:
       - Add alias mapping to `parseRowsFromHeaderAoA()`
       - Extract value in `parseVelanExcel()` and `parseGenericRows()`

2. DATA NORMALIZER:
   └── Modify `src/services/dataNormalizer.js`:
       - Add normalization function `normalizeBatchNo()` if required
   └── Modify `src/utils/normalizeRow.js`:
       - Include `batchNo` in canonical normalized row output

3. BACKEND ZOD SCHEMA:
   └── Modify `src/server/schemas/upload.schema.js`:
       - Add `batchNo: flexField` to `rowSchema`

4. BACKEND DEDUPLICATION & QUERIES:
   └── Modify `src/server/db/pool.js`:
       - Update `makeKey()` if the new field participates in row uniqueness
       - Add indexing if searched frequently

5. FRONTEND TABLE COMPONENTS:
   └── Modify `src/components/DataTable.jsx`, `DatabaseTable.jsx`, `VirtualizedTable.jsx`:
       - Add column header and row cell renderer
```

---

### 2.2 Scenario: Modifying the SLA Target or Holiday Calendar
*Example: Changing standard SLA from 21 to 15 working days or adding a new company holiday.*

```
1. CALCULATION UTILITIES:
   └── Modify `src/utils/calculationUtils.cjs`:
       - Update `TARGET_DAYS = 15`
       - Add ISO date string (e.g. `'2026-12-25'`) to `COMPANY_HOLIDAYS` Set

2. ALERT ENGINE:
   └── Modify `src/server/db/pool.js` / `alert_rules`:
       - Adjust threshold values for `po_delay_warning`, `po_delay_danger`, `po_delay_critical`

3. PREDICTIVE & FORECAST ENGINES:
   └── Check `src/server/forecast/slaEngine.js`, `capacityPlanner.js`, `micService.js`
       - Ensure threshold variables reflect the new target duration

4. FRONTEND LABELS & TESTS:
   └── Update `src/__tests__/utils/calculationUtils.test.js`
   └── Update static UI text mentioning "21 Days" across pages
```

---

### 2.3 Scenario: Adding a New Dashboard KPI
*Example: Adding a "First Pass Yield (FPY %)" KPI.*

```
1. BACKEND SERVICE:
   └── Modify `src/server/services/kpiService.js`:
       - Add calculation logic inside `calculateKPIs()`
       - Return new property `firstPassYieldPct`

2. API ROUTE:
   └── Verify `src/server/routes/dashboard.js` returns the property in `/api/dashboard/calculations`

3. FRONTEND BACKEND KPI HOOK:
   └── Modify `src/hooks/useBackendKPIs.js`:
       - Add `firstPassYieldPct: 0` to `getDefaultKPIs()` fallback

4. FRONTEND UI COMPONENTS:
   └── Modify `src/pages/OverviewPage.jsx` or `KPICard.jsx`:
       - Add new `<KPICard title="First Pass Yield" value={`${kpis.firstPassYieldPct}%`} icon={CheckCircle} />`
```

---

### 2.4 Scenario: Adding a New Operational Stage
*Example: Adding an "ELECTRO-PLATING" (`EP`) internal manufacturing stage.*

```
1. STAGE NORMALIZER & RESOLVER:
   └── Modify `src/services/dataNormalizer.js`:
       - Add alias mapping in `normalizeStage()` (e.g., `'ELECTROPLATING'` -> `'EP'`)
       - Add stage color in `getStageColor()` (e.g., `'EP' -> '#e056fd'`)
   └── Modify `src/services/stageResolver.js`:
       - Add `'EP'` to `knownStages` array in `extractStageFromStatusText()`

2. FRONTEND FILTERS:
   └── Automatically detected in dropdowns via `uniqueStages` in `DataContext.jsx`
```

---

### 2.5 Scenario: Adding a New Raw Material Inventory Type
*Example: Adding "Hollow Bars" to cutting workshop management.*

```
1. DATABASE SCHEMA:
   └── Modify `src/server/db/pool.js`:
       - Update `long_bars` table schema or add category column

2. INVENTORY API ROUTE:
   └── Modify `src/server/routes/inventory.js`:
       - Update `POST /api/inventory/long-bars` and `POST /api/inventory/cut-pieces/define` validation

3. FRONTEND INVENTORY PAGE:
   └── Modify `src/pages/InventoryPage.jsx`:
       - Update form dropdowns for raw bar material category selection
```
