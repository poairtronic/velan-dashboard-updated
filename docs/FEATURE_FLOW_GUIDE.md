# Velan Dashboard - Enhanced Feature Flow Guide

## Complete User Journey Map

```
VELAN METROLOGY DASHBOARD
├─ OVERVIEW PORTAL
│  ├─ Card 1: "Daily Set" [Click] → Modal
│  │  └─ Shows list of POs with Daily Set items
│  │     └─ Each PO expandable → Shows SCs
│  │        └─ Each SC expandable → Shows Items
│  │
│  ├─ Card 2: "Delayed PO" [Click] → Modal  
│  │  └─ Shows list of Delayed POs (>2d pending or >21d cycle)
│  │     └─ Each PO expandable → Shows SCs
│  │        └─ Each SC expandable → Shows Items with RED indicator
│  │
│  └─ Card 3: "InProgress" [Click] → Modal
│     └─ Shows list of InProgress POs
│        └─ Each PO expandable → Shows SCs
│           └─ Each SC expandable → Shows Items
│
├─ STAGE / WIP MODULE
│  ├─ Filter by Stage (HOV, BLV, HCV, etc.)
│  ├─ For each Stage:
│  │  ├─ Show ALL items INDIVIDUALLY (no lathe/m1 grouping)
│  │  └─ Each Item Row [Click] → Expandable Details
│  │     └─ Shows:
│  │        ├─ PO number
│  │        ├─ SC number
│  │        ├─ Product name
│  │        ├─ Current stage
│  │        ├─ Cycle time
│  │        └─ Pending days
│  │
│  └─ Color Coding:
│     ├─ 🔴 RED: Delayed (>2d pending)
│     ├─ 🟡 YELLOW: Warning (approaching limit)
│     └─ 🟢 GREEN: On-track
│
├─ CYCLE TIME PER STAGE
│  ├─ Stage List (HOV is FIRST, NO STORE)
│  │  ├─ HOV → Avg Duration (integer), Cumulative Days (integer)
│  │  ├─ BLV → Avg Duration (integer), Cumulative Days (integer)
│  │  ├─ HCV → Avg Duration (integer), Cumulative Days (integer)
│  │  └─ ... (other stages, EXCLUDING STORE)
│  │
│  └─ Full Details View [Click] → Modal
│     └─ All items passing through that stage
│        ├─ Display in table with integer duration values
│        ├─ No decimal places (e.g., "5 days" not "5.3 days")
│        └─ Sorted by cycle time descending
│
├─ PO ANALYSIS
│  ├─ All POs displayed with summary stats
│  │  ├─ Total items count
│  │  ├─ Delayed count (highlighted RED if > 0)
│  │  ├─ On-time count (highlighted GREEN)
│  │  └─ Average cycle time
│  │
│  └─ DELAYED PO Section [Click any PO] → Expandable Details
│     ├─ Shows PO number prominently
│     ├─ Shows all SC numbers in that PO
│     ├─ Shows all items with:
│     │  ├─ Item name
│     │  ├─ SC number
│     │  ├─ Current stage  
│     │  ├─ Cycle time
│     │  ├─ Pending days (RED if >2d)
│     │  └─ Status (Delayed/On-Time/In-Progress)
│     │
│     └─ Summary Stats for that PO
│        ├─ Total items
│        ├─ Delayed items count & %
│        ├─ On-time items count & %
│        └─ Average cycle time
│
├─ SC SETS (Already has detail modal from Phase 6)
│  └─ [SC Number] [Click] → Modal with product-level details
│     ├─ All items in SC
│     ├─ Processing status per item
│     ├─ Color-coded: Red=Delayed, Green=Completed
│     └─ Summary KPIs
│
└─ VENDOR EVAL
   ├─ Vendor list with summary stats
   │  └─ Each Vendor [Click] → Shows vendor's items
   │
   ├─ Vendor Items Table
   │  └─ Each Item Row [Click] → Detailed Modal
   │     ├─ Item details:
   │     │  ├─ Product name
   │     │  ├─ Item type
   │     │  ├─ PO number [Link]
   │     │  ├─ SC number [Link]
   │     │  ├─ Current process stage
   │     │  ├─ Last update
   │     │  ├─ Cycle time
   │     │  ├─ Pending days
   │     │  └─ Status badges
   │     │
   │     ├─ Quick Links:
   │     │  ├─ View in PO Analysis
   │     │  ├─ View in SC Details
   │     │  └─ View in Stage Module
   │     │
   │     └─ Processing Timeline (if available)
```

---

## How Each Feature Works - Step by Step

### FEATURE 1: Overview Portal - Daily Set, Delayed PO, InProgress

**Three Main Cards at Top of Overview:**

```
┌─────────────────────────┬──────────────────────┬──────────────────┐
│  DAILY SET              │  DELAYED PO          │  INPROGRESS      │
│  [42 Items]             │  [8 POs]             │  [156 Items]     │
│  Click for details  →   │  Click for details → │  Click for ...   │
└─────────────────────────┴──────────────────────┴──────────────────┘
       ↓ Click              ↓ Click                ↓ Click
    MODAL OPENS         MODAL OPENS            MODAL OPENS
    Shows:              Shows:                 Shows:
    - PO List           - Delayed PO List      - InProgress PO List
    - Expand PO → SCs   - Expand PO → SCs      - Expand PO → SCs
    - Expand SC → Items - Expand SC → Items    - Expand SC → Items
```

**Logic:**
- **Daily Set:** Items created TODAY
- **Delayed PO:** POs with any item > 2 days pending
- **InProgress:** All items currently in production (not completed)

**Data Structure in Modal:**
```
PO-001
  ├─ SC-A001 [Click to expand]
  │  ├─ Item 1 | Product | Stage | Days
  │  ├─ Item 2 | Product | Stage | Days
  │  └─ Item 3 | Product | Stage | Days
  ├─ SC-A002 [Click to expand]
  │  ├─ Item 1 | Product | Stage | Days
  │  └─ Item 2 | Product | Stage | Days
  └─ SC-A003
     └─ Item 1 | Product | Stage | Days
```

---

### FEATURE 2: Stage/WIP Module - Separated Items

**Current Problem:** Items grouped as "lathe/m1 (5 items)"
**New Solution:** List all items separately

```
STAGE: HOV
├─ ┌─────────────────────────────────────────┐
│  │ PO-001 | SC-A001 | Product X | 3 days  │ [Click]
│  └─────────────────────────────────────────┘
│     └─ Expanded Details:
│        PO: PO-001
│        SC: SC-A001
│        Product: Product X
│        Current Stage: HOV
│        Duration: 3 days
│        Status: In Progress
│
├─ ┌─────────────────────────────────────────┐
│  │ PO-001 | SC-A002 | Product Y | 2 days  │ [Click]
│  └─────────────────────────────────────────┘
│
├─ ┌─────────────────────────────────────────┐
│  │ PO-002 | SC-B001 | Product Z | 5 days  │ [Click] 🔴
│  └─────────────────────────────────────────┘
│
└─ ┌─────────────────────────────────────────┐
   │ PO-003 | SC-A005 | Product W | 1 day   │ [Click]
   └─────────────────────────────────────────┘
```

---

### FEATURE 3: Cycle Time Per Stage

**Key Changes:**
1. **Remove STORE stage completely**
2. **HOV is FIRST stage** (not lathe/m1)
3. **Integer values only** (5 days, not 5.3 days)

```
CYCLE TIME ANALYSIS
├─ HOV (First Process)
│  ├─ Avg Duration: 2 days (integer)
│  ├─ Cumulative: 2 days
│  └─ [View Full Details] → Shows all items with integer duration
│
├─ BLV
│  ├─ Avg Duration: 3 days
│  ├─ Cumulative: 5 days
│  └─ [View Full Details]
│
├─ HCV
│  ├─ Avg Duration: 2 days
│  ├─ Cumulative: 7 days
│  └─ [View Full Details]
│
├─ FBV
│  ├─ Avg Duration: 1 day
│  ├─ Cumulative: 8 days
│  └─ [View Full Details]
│
└─ HTV
   ├─ Avg Duration: 2 days
   ├─ Cumulative: 10 days
   └─ [View Full Details]

(NO STORE ELEMENT SHOWN)
```

**Full Details Modal Example:**
```
Stage: HOV Details
┌──────┬──────────┬─────────┬──────────┬──────────┐
│ PO   │ SC       │ Product │ Duration │ Pending  │
├──────┼──────────┼─────────┼──────────┼──────────┤
│ PO-01│ SC-A001  │ Prod X  │ 3 days   │ 1 day    │
│ PO-01│ SC-A002  │ Prod Y  │ 2 days   │ 5 days   │
│ PO-02│ SC-B001  │ Prod Z  │ 4 days   │ 2 days   │
│ PO-03│ SC-A005  │ Prod W  │ 2 days   │ 0 days   │
└──────┴──────────┴─────────┴──────────┴──────────┘
```

---

### FEATURE 4: PO Analysis - Delayed PO Details

```
PO ANALYSIS PAGE
├─ Summary Cards
│  ├─ Total POs: 45
│  ├─ Delayed POs: 8 (HIGHLIGHTED RED)
│  ├─ On-Time POs: 37 (HIGHLIGHTED GREEN)
│  └─ Avg Cycle Time: 15 days
│
└─ PO List Table
   │
   ├─ ┌────────┬────────┬──────────┬──────────┬─────────┐
   │  │ PO     │ SCs    │ Items    │ Delayed# │ Status  │
   │  ├────────┼────────┼──────────┼──────────┼─────────┤
   │  │PO-001  │   3    │   8      │    2 🔴  │ DELAYED │ [Click]
   │  ├────────┼────────┼──────────┼──────────┼─────────┤
   │  │PO-002  │   2    │   5      │    0 🟢  │ ON-TIME │ [Click]
   │  └────────┴────────┴──────────┴──────────┴─────────┘
   │
   └─ [Click on any PO, especially DELAYED ones] → EXPANDED DETAILS
      
      PO-001 Details
      ├─ PO Number: PO-001
      ├─ Total Items: 8
      ├─ Delayed Items: 2
      ├─ On-Time Items: 6
      ├─ Avg Cycle Time: 18 days
      │
      ├─ SCs in this PO:
      │  ├─ SC-A001 [Click to expand]
      │  │  ├─ Item 1 | Status | Cycle | Pending | 🔴
      │  │  └─ Item 2 | Status | Cycle | Pending | 🟢
      │  │
      │  ├─ SC-A002
      │  │  ├─ Item 1 | Status | Cycle | Pending | 🔴
      │  │  └─ Item 2 | Status | Cycle | Pending | 🟢
      │  │
      │  └─ SC-A003
      │     ├─ Item 1 | Status | Cycle | Pending | 🟢
      │     └─ Item 2 | Status | Cycle | Pending | 🟢
      │
      └─ Summary Stats
         ├─ Total: 8 items
         ├─ Delayed: 2 items (25%)
         ├─ On-Time: 6 items (75%)
         └─ Average Cycle: 18 days
```

---

### FEATURE 5: Vendor Eval - Item Click Details

**Current State:** SC modal exists from Phase 6
**Enhancement:** Item-level click details

```
VENDOR EVAL PAGE
├─ Vendor List (summary)
│  ├─ VENDOR-A: 45 items, 3 delayed
│  ├─ VENDOR-B: 32 items, 1 delayed
│  └─ VENDOR-C: 28 items, 0 delayed
│
└─ Vendor Items Table
   │
   ├─ ┌──────┬──────────┬─────────────┬──────────┬─────────┐
   │  │ PO   │ SC       │ Product     │ Stage    │ Days    │
   │  ├──────┼──────────┼─────────────┼──────────┼─────────┤
   │  │PO-001│ SC-A001  │ Airplug     │ HOV      │ 3 days  │ [Click]
   │  ├──────┼──────────┼─────────────┼──────────┼─────────┤
   │  │PO-001│ SC-A002  │ Master Ring │ BLV      │ 5 days  │ [Click]
   │  ├──────┼──────────┼─────────────┼──────────┼─────────┤
   │  │PO-002│ SC-B001  │ Airplug     │ HCV      │ 7 days  │ [Click]
   │  └──────┴──────────┴─────────────┴──────────┴─────────┘
   │
   └─ [Click any item] → DETAILED MODAL
      
      Item Details Modal
      ┌────────────────────────────────────────────┐
      │ Item Information                           │
      ├────────────────────────────────────────────┤
      │ PO Number:        PO-001                   │
      │ SC Number:        SC-A001                  │
      │ Product Name:     Airplug APG-123          │
      │ Product Type:     AIRPLUG                  │
      │ Current Stage:    HOV                      │
      │ Last Update:      2026-04-22 14:30:00      │
      │ Cycle Time:       3 days                   │
      │ Pending Days:     1 day                    │
      │ Status:           IN PROGRESS 🟡           │
      │ Vendor:           VENDOR-A                 │
      │                                            │
      │ [Quick Links]                              │
      │ [View in PO Analysis] [View in SC Details] │
      │ [View in Stage Module]                     │
      └────────────────────────────────────────────┘
```

---

## Implementation Sequence & Activation

### Phase 1: Overview Portal (Days 1-2)
1. Add 3 KPI cards at top of OverviewPage
2. Create modal component for each category
3. Implement expandable PO/SC/Item structure
4. **Activate:** Card shows count, click opens modal

### Phase 2: Stage/WIP Separation (Days 2-3)
1. Modify WIPPage to remove grouping by type
2. List each item individually
3. Add click handler for item details
4. **Activate:** Each item row clickable → shows PO/SC

### Phase 3: Cycle Time Fixes (Days 3-4)
1. Filter out STORE stage
2. Reorder stages (HOV first)
3. Convert all numbers to integers
4. **Activate:** Update calculations and display

### Phase 4: PO Analysis Enhancement (Days 4-5)
1. Identify delayed POs
2. Make PO rows clickable
3. Create expandable modal
4. **Activate:** Click PO → see delayed items

### Phase 5: Vendor Eval Enhancement (Days 5-6)
1. Add click handler to vendor items
2. Create detailed item modal
3. Add quick links to other modules
4. **Activate:** Click item → see all details

---

## Testing Checklist

- [ ] Overview: Daily Set modal shows 3+ POs with SCs and items
- [ ] Overview: Delayed PO count matches items with >2d pending
- [ ] Overview: InProgress shows all non-completed items
- [ ] Stage/WIP: No grouping visible, all items listed separately
- [ ] Stage/WIP: Click item shows PO and SC numbers
- [ ] Cycle Time: STORE stage not visible anywhere
- [ ] Cycle Time: HOV is first in list
- [ ] Cycle Time: All numbers are integers (no decimals)
- [ ] PO Analysis: Delayed POs highlighted in red
- [ ] PO Analysis: Click PO shows all SCs and items
- [ ] Vendor Eval: Click item opens modal with full details
- [ ] Vendor Eval: Quick links navigate correctly

---

## Color Coding Guide

```
🔴 RED:     Delayed (>2 days pending) OR Cycle time >21 days
🟡 YELLOW:  Warning (approaching limits) OR 1-2 days pending  
🟢 GREEN:   On-time OR Completed OR <1 day pending
⚪ NEUTRAL: Not applicable or in-progress
```

