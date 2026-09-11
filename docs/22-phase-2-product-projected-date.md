# 22 - Phase 2: Product Projected Date

## 1. Objective
The objective of Phase 2 is to extract, normalize, store, and display the `PROJECTED DATE` for individual manufacturing products from the source spreadsheet to the dashboard UI.

## 2. Scope Constraints
- **In Scope:** Individual Product-level `PROJECTED DATE`.
- **Out of Scope (Phase 3 & 4):**
  - SC-level Production Date calculations (`scProductionDate = MAX(projectedDate)`).
  - PO-level Estimated Delivery calculations (e.g., `poDate + 6 weeks`).
  - No SC-level or PO-level delivery estimates are calculated or displayed in this phase.

## 3. Data Lineage

### 3.1. Extraction (Parser)
File: `src/services/excelParser.js`
The parser maps the following raw spreadsheet column aliases to the canonical `projectedDate` field:
- `projecteddate`
- `projected date`
- `projected`
- `mfgduedate`
- `mfg due date`
- `targetcompletion`
- `target completion`
- `targetdate`
- `target date`
- `duedate`
- `due date`
- `expectedcompletion`
- `expected completion`
- `expected completion date`
- `productprojecteddate`
- `product projected date`

If multiple variations exist, `pickField` and `findColumn` capture the first matched value safely.

### 3.2. Normalization
File: `src/utils/normalizeRow.js` and `src/utils/dateUtils.js`
The raw date value is passed through `toIsoDateString(raw.projectedDate)`.
- Valid dates (e.g., `DD/MM/YYYY`, `MM/DD/YYYY`, or Excel serial numbers) are safely parsed to `YYYY-MM-DD`.
- Missing dates (`null`, empty string) are handled safely and remain `null` or `''`.
- Invalid dates that cannot be parsed are converted to an empty string.
- Timezone safety is ensured as the parser performs date-only string manipulation without leveraging the default JavaScript `Date` constructor which can cause off-by-one-day errors.

### 3.3. Persistence
Files: `src/server/schemas/upload.schema.js`, PostgreSQL `velan_live_rows` & `velan_rows`
- The upload schema validates `projectedDate` as a flexible field (string, number, or null).
- It is stored directly within the unstructured JSONB `data` column payload alongside other product attributes.
- Duplicate rows resolve following the existing `latestMap` row precedence strategy (by timestamp or live vs db status).

### 3.4. API & UI Presentation
Files: `src/server/services/dataQueryService.js`, `src/pages/SCPage.jsx`
- The `getFilteredData` API passes the row objects, including `projectedDate`, to the frontend.
- The `SCPage.jsx` UI renders the value in the Product-level table under the **PROJECTED DATE** column.
- The display format uses the standard `fmtDate()` utility to present dates as `DD/MM/YYYY`. Missing or invalid dates are gracefully displayed as `—`.
- Dates are rendered with a distinct accent color (`#00c9ff`) when present.

## 4. Phase Validation Checklist
- [x] PROJECTED DATE is read from the source spreadsheet.
- [x] projectedDate is normalized correctly.
- [x] date-only timezone conversion is safe.
- [x] projectedDate survives synchronization.
- [x] projectedDate survives database storage.
- [x] projectedDate is returned by the existing SC API.
- [x] each product receives its own projectedDate.
- [x] duplicate rows follow existing row precedence.
- [x] missing projectedDate is safe.
- [x] invalid projectedDate is safe.
- [x] UI displays PROJECTED DATE.
- [x] date display uses existing application format.
- [x] changing one product date does not affect another product.
- [x] live synchronization updates the UI correctly.
