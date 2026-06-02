# Implementation Roadmap & Activation Guide

## Quick Start: How to Activate Each Feature

### Feature 1: Overview Portal - Daily Set, Delayed PO, InProgress
**Location:** OverviewPage (around line 1597)
**Current Status:** ❌ Not implemented
**Activation Method:** After code implementation:
1. Load dashboard, click "Overview" tab
2. Scroll to top - see 3 cards: "Daily Set", "Delayed PO", "InProgress"
3. Each card shows count
4. **Click any card** → Modal opens with details
5. **Click PO in modal** → Expands to show SCs
6. **Click SC in modal** → Expands to show Items

**What Changes:**
- New component: `OverviewStatsModal`
- New function: `getCategoryData(category)` to group items by Daily/Delayed/InProgress
- New state in OverviewPage: `selectedCategory`, `isModalOpen`

---

### Feature 2: Stage/WIP Module - Separated Items
**Location:** WIPPage (around line 1856)
**Current Status:** ❌ Not implemented
**Activation Method:** After code implementation:
1. Load dashboard, click "Stage / WIP" tab
2. Use filters to select a specific stage (e.g., "HOV")
3. See items listed individually - **NO grouping by lathe/m1**
4. Each row shows: PO | SC | Product | Days Pending
5. **Click any item row** → Expandable details showing:
   - PO number
   - SC number
   - Full item info
   - Status indicators

**What Changes:**
- Remove item grouping logic in WIPPage
- Flatten itemsByStage structure
- Add click handler to each item
- Add expandable details component

---

### Feature 3: Cycle Time Per Stage
**Location:** CycleTimePage (around line 1948)
**Current Status:** ⚠️ Partially implemented (needs fixes)
**Activation Method:** After code implementation:
1. Load dashboard, click "Cycle Time" tab
2. See stage list: **HOV (FIRST), BLV, HCV, FBV, HTV** (NO STORE)
3. Each stage shows:
   - Avg Duration (integer, e.g., "2 days")
   - Cumulative Days (integer, e.g., "5 days")
4. **Click "Full Details"** on any stage → Modal opens showing all items
5. Table displays in integer format only

**What Changes:**
- Filter out stages where name === "STORE"
- Reorder stages to put HOV first
- Apply `Math.round()` to all duration calculations
- Update display format to remove decimal places
- Update modal to show integer values only

---

### Feature 4: PO Analysis - Delayed PO Details
**Location:** POPage (around line 2251)
**Current Status:** ❌ Not implemented
**Activation Method:** After code implementation:
1. Load dashboard, click "PO Analysis" tab
2. See PO list with columns: PO | SCs Count | Items Count | Delayed Count | Status
3. **Delayed POs** highlighted in RED
4. **Click any PO row** → Expands to show:
   - All SCs in that PO
   - All items with status indicators
   - Summary stats
5. **Click any SC within PO** → Expands to show items

**What Changes:**
- New function: `isDelayedPO(po, data)` to check if PO has delayed items
- New component: `PODetailsExpandable` 
- New state: `expandedPO` to track which PO is expanded
- Color coding: Red for delayed items in modal

---

### Feature 5: Vendor Eval - Item Click Details
**Location:** VendorPage (around line 2424)
**Current Status:** ✅ Partially done (SC modal exists, need item modal)
**Activation Method:** After code implementation:
1. Load dashboard, click "Vendor Eval" tab
2. See vendor list and items table
3. SC modal already works (from Phase 6)
4. **New Feature:** Click any item in table → Detailed modal shows:
   - PO number
   - SC number
   - Product name & type
   - Current stage
   - Cycle time
   - Pending days
   - Status badges
   - Quick links to PO Analysis / SC Details / Stage Module
5. **Modal has action buttons** to navigate to related data

**What Changes:**
- New function: `openItemDetails(item)`
- New component: `ItemDetailsModal`
- New state: `selectedItem`, `showItemModal`
- Keep existing SC modal (no changes needed)

---

## Code Modification Summary

### Files to Modify
Only one file: `index.html`

### Key Locations
| Feature | Function | Line | Changes |
|---------|----------|------|---------|
| Overview | OverviewPage | ~1597 | Add 3 cards + modal |
| Stage/WIP | WIPPage | ~1856 | Remove grouping, add click |
| Cycle Time | CycleTimePage | ~1948 | Filter STORE, integer values |
| PO Analysis | POPage | ~2251 | Make PO clickable, add expansion |
| Vendor Eval | VendorPage | ~2424 | Add item detail modal |

---

## Helper Functions to Add/Modify

```javascript
// NEW: Get items by category for Overview
function getOverviewStats(data, today) {
  const daily = data.filter(d => d.poDate === today.toISOString().split('T')[0]);
  const delayed = data.filter(d => calculateVendorAging(d.timestamp, today) > 2);
  const inprogress = data.filter(d => d.status1 !== 'COMPLETED');
  return { daily, delayed, inprogress };
}

// NEW: Check if PO is delayed
function isPODelayed(po, data) {
  const poItems = data.filter(d => d.po === po);
  return poItems.some(item => calculateVendorAging(item.timestamp, new Date()) > 2);
}

// MODIFY: Format numbers as integers
function formatInteger(value) {
  return Math.round(value);
}

// NEW: Get stage order (HOV first, no STORE)
const STAGE_ORDER = ['HOV', 'BLV', 'HCV', 'FBV', 'HTV', 'PBV'];
// Use: stages.sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));
```

---

## Data Flow Diagram

```
USER ACTION                 STATE UPDATE              DISPLAY
──────────                  ────────────              ───────

Click "Overview" tab   →    activeNav = 'overview'  →  OverviewPage renders
                                                      Shows 3 cards with counts
                                                      
Click "Daily Set" card →   selectedCategory = 'daily' → OverviewStatsModal opens
                           isModalOpen = true          Shows PO list

Click PO in modal    →     expandedPO = 'PO-001'     → PO row expands
                                                      Shows SCs below PO

Click SC in modal    →     expandedSC = 'SC-A001'    → SC row expands
                                                      Shows items below SC

Click "Stage/WIP" tab →    activeNav = 'wip'         → WIPPage renders
                                                      Shows items by stage

Select stage filter  →     filters.stage = 'HOV'     → Items filtered & listed
                                                      Each item separate row

Click item row       →     selectedItem = {item}     → Row expands
                           showItemDetails = true      Shows PO, SC details

Click "Cycle Time"  →     activeNav = 'cycletime'  → CycleTimePage renders
                                                    Shows stages (HOV first, no STORE)
                                                    Integer values only

Click stage details →     selectedStage = 'HOV'     → Modal opens
                         showStageDetails = true     Shows all items in integer format
```

---

## Testing Scenarios

### Scenario 1: Overview - Daily Set
1. Open dashboard
2. Click "Overview" tab
3. Click "Daily Set" card (count should = items created today)
4. **Expected:** Modal shows POs created today
5. **Verify:** Can expand each PO to see SCs and items

### Scenario 2: Stage/WIP - Separated Items
1. Open dashboard
2. Click "Stage / WIP" tab
3. Filter by "HOV" stage
4. **Expected:** See 5-10 individual item rows (not grouped)
5. **Verify:** Each row shows different PO/SC combinations
6. Click first item
7. **Expected:** Row expands showing PO and SC numbers

### Scenario 3: Cycle Time - Integer Values
1. Open dashboard
2. Click "Cycle Time" tab
3. **Expected:** See stages HOV, BLV, HCV, FBV, HTV (NO STORE)
4. **Verify:** All numbers show as integers (2 days, not 2.3 days)
5. Click "Full Details" on HOV stage
6. **Expected:** Modal table shows all values as integers

### Scenario 4: PO Analysis - Delayed POs
1. Open dashboard
2. Click "PO Analysis" tab
3. **Expected:** Delayed POs highlighted in RED
4. Click on a red PO row
5. **Expected:** Modal opens showing:
   - All SCs in PO
   - All items with RED indicator for delayed items
   - Summary stats showing delayed % count

### Scenario 5: Vendor Eval - Item Details
1. Open dashboard
2. Click "Vendor Eval" tab
3. Click any item in vendor items table
4. **Expected:** Modal opens with:
   - PO number
   - SC number
   - Product name
   - Current stage
   - Processing status
5. Click "View in PO Analysis" button
6. **Expected:** Navigates to PO Analysis tab with that PO highlighted

---

## Debugging Tips

### Issue: Overview modal not showing items
**Check:** Does `getOverviewStats()` return correct data?
```javascript
console.log('Daily items:', daily.length);
console.log('Delayed items:', delayed.length);
console.log('InProgress items:', inprogress.length);
```

### Issue: Stage/WIP showing grouped items
**Check:** Verify items are NOT being grouped by type
```javascript
const flatItems = data.filter(d => d.currentStage === selectedStage);
// Should NOT have: itemsByType, groupBy, reduce with nested objects
```

### Issue: Cycle Time showing decimals
**Check:** All calculations wrapped in Math.round()?
```javascript
const avgDuration = Math.round(totalDays / count); // NOT totalDays / count
```

### Issue: PO Analysis not showing delayed POs
**Check:** Is `isPODelayed()` correctly identifying delayed items?
```javascript
const agingDays = calculateVendorAging(item.timestamp, today);
console.log(`Item ${item.sc}: ${agingDays} days old`);
// Should show > 2 for delayed items
```

### Issue: Vendor item modal not opening
**Check:** Is click handler properly attached?
```javascript
onClick={() => setSelectedItem(item)}  // or openItemDetails(item)
showItemModal && <ItemDetailsModal />  // or conditional rendering
```

---

## Phase Implementation Sequence

```
DAY 1: Overview Portal (Feature 1)
├─ Create OverviewStatsModal component
├─ Add 3 KPI cards
├─ Implement expandable structure
└─ Test with sample data

DAY 2: Stage/WIP Separation (Feature 2)
├─ Remove item grouping logic
├─ Add individual item rows
├─ Implement click handler
└─ Add details component

DAY 3: Cycle Time Fixes (Feature 3)
├─ Filter STORE stage
├─ Reorder stages (HOV first)
├─ Apply Math.round to all calculations
└─ Update display format

DAY 4: PO Analysis (Feature 4)
├─ Identify delayed POs
├─ Make rows clickable
├─ Create expandable modal
└─ Add color coding

DAY 5: Vendor Eval Enhancement (Feature 5)
├─ Create item detail modal
├─ Add click handler to vendor items
├─ Add quick navigation links
└─ Final testing & debugging
```

---

## Success Criteria

✅ **Overview:** 3 cards clickable, modals show correct data, expandable structure works
✅ **Stage/WIP:** Items listed individually, click shows PO/SC, no grouping visible
✅ **Cycle Time:** HOV first, no STORE, all integer values, full details modal works
✅ **PO Analysis:** Delayed POs red, click expands to show details, SC expansion works
✅ **Vendor Eval:** Item click shows modal, quick links work, all details populate

---

## Next Step: Implementation

Ready to implement all 5 features? Let me know and I'll:
1. Add Overview modal with 3 cards
2. Remove Stage grouping and add individual items
3. Fix Cycle Time (STORE removal, integer values, HOV first)
4. Enhance PO Analysis with delayed PO expansion
5. Add Vendor item detail modal

Each feature will be tested before moving to the next.

