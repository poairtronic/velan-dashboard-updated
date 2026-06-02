# Vendor Dashboard Process Metrics & Bottleneck Detection
## Implementation Guide

---

## 📊 Overview

The Velan Metrology dashboard now includes comprehensive **process time calculations**, **cycle time tracking**, **SLA monitoring**, and **bottleneck detection** specifically designed for vendor operations. These metrics help you identify delays, optimize processes, and manage vendor performance effectively.

---

## 🎯 Key Features Implemented

### 1. **Process Cycle Time Calculation**
**Formula**: `Cycle Time = Current Timestamp - PO Receipt Date`

Measures the total time from when a purchase order is received until the item reaches its current processing stage.

- **Unit**: Days
- **Example**: Item received on 2026-03-25, currently at stage on 2026-04-15 = 21 days
- **Use**: Identify which POs take longest in the pipeline

---

### 2. **Vendor Aging Detection**
**Formula**: `Aging = Today's Date - Last Update Timestamp`

Tracks how many days have passed since a vendor item was last updated. This identifies stalled processes.

- **Unit**: Days  
- **Color Coding**:
  - 🟢 **Green** (0-2 days): Active/Recent updates
  - 🟡 **Yellow** (3-7 days): Moderate delay
  - 🔴 **Red** (>7 days): Significant delay

---

### 3. **SLA Tracking (>2 Days = RED)**
**Threshold**: Items with >2 days since last update = **SLA VIOLATION**

Monitors compliance with service level agreements. Violations indicate items requiring immediate attention.

- **Metrics Tracked**:
  - **SLA Violations**: Count of items exceeding 2-day threshold
  - **SLA Violation Rate**: Percentage of vendor's total items violating SLA
  - **Status Display**: VIOLATION (red) vs COMPLIANT (green)

---

### 4. **Process Efficiency**
**Formula**: `Efficiency % = (Completed Items / Total Items) × 100`

Measures what percentage of vendor items have successfully completed processing (reached READY, STORES, or STOCK stages).

- **Range**: 0-100%
- **Target**: 80%+ is considered good
- **Color Coding**:
  - 🟢 **Green** (80-100%): Excellent
  - 🟡 **Yellow** (60-79%): Acceptable
  - 🔴 **Red** (<60%): Needs improvement

---

### 5. **Bottleneck Detection**
**Formula**: `Bottleneck Score = Average Pending Days × log(Item Count + 1)`

Identifies the vendor operation with the highest risk. Uses weighted scoring that considers both the duration items spend pending AND the volume being processed.

- **Components**:
  - **Average Pending Days**: How long items are waiting on average
  - **Item Count**: Volume of items in the operation
  - **Weighted Score**: Balances duration and volume

**Alert Display**: Shows the top bottleneck vendor operation with recommendations.

---

## 📈 Vendor Dashboard Sections

### **KPI Cards** (Top Section)
- Inhouse Items vs Vendor Items split
- Distinct vendor operations count
- Slowest vendor operation (highest aging)
- Most delayed items (>21 days pending)

### **Process Cycle Time & Efficiency Table**
For each vendor operation, displays:
| Metric | Description |
|--------|-------------|
| **Vendor OP** | Operation code (e.g., SDV, BLV, HOV) |
| **Avg Process Time** | Days from PO to current stage |
| **Completion Rate** | % of items completed |
| **SLA Violations** | Count of items >2 days pending |
| **Violation Rate** | % of items violating SLA |
| **Status Badge** | ✓ COMPLIANT / ⚡ WARNING / ⚠ CRITICAL |

### **Bottleneck Alert Box** (If applicable)
Shows the highest-risk vendor operation:
- Operation code
- Average pending days
- SLA violations count
- Process efficiency
- Recommendation for action

### **Enhanced Vendor Detail Table**
Complete vendor metrics with new columns:
- **PROCESS CYCLE**: Avg days from PO receipt
- **EFFICIENCY**: % completion rate
- **SLA VIOLATIONS**: Count of delayed items

### **Item-Level Tracking Table**
Detailed view of each vendor item:
- SC / PO / Product information
- Last update timestamp
- **PENDING DAYS**: Aging calculation
- **CYCLE TIME**: Days in current stage
- **SLA STATUS**: Violation indicator
- **STATUS**: Active or Delayed

---

## 🔧 How Process Metrics Work

### Example Scenario:

**Vendor Operation: SDV (Supplier Drill & Verify)**
- Total Items: 5
- Items with >2 days pending: 2
- Average pending days: 4.2 days
- Completed items: 3
- Items still in processing: 2

**Calculations**:
```
Aging:
  Item 1: Updated 2 days ago → 🟢 Active
  Item 2: Updated 5 days ago → 🟡 Warning
  Item 3: Updated 8 days ago → 🔴 Delayed (SLA VIOLATION)
  Item 4: Updated 3 days ago → 🟡 Warning
  Item 5: Updated 1 day ago → 🟢 Active

SLA Violations: 2 items (Items 2 & 3)
SLA Violation Rate: 40% (2/5)

Process Efficiency: 60% (3 completed / 5 total)

Cycle Time (PO to Current Stage):
  Average: 18 days (from PO receipt to current stage)

Bottleneck Score: 4.2 × log(5+1) = 4.2 × 1.79 = 7.5
```

---

## 📊 Metrics Data Flow

```
Raw Data (with Timestamp & PO Date)
         ↓
Filter Vendor Items (inhouse === "VENDOR")
         ↓
Group by Vendor Operation (currentStage for vendors)
         ↓
Calculate Per-Item Metrics:
  • Aging = Today - Last Update
  • Cycle Time = Current TS - PO Date
  • SLA Status = Aging > 2 days?
         ↓
Aggregate Per-Vendor Metrics:
  • Avg/Max pending days
  • SLA violations count & rate
  • Process efficiency %
  • Bottleneck score
         ↓
Display on Dashboard with Color Coding
```

---

## 🎨 Color & Status Reference

### Aging Status
| Days | Color | Label |
|------|-------|-------|
| 0-2d | 🟢 Green | Active |
| 3-7d | 🟡 Yellow | Warning |
| 8-14d | 🔴 Red | Delayed |
| 15+ | 🔴 Red | Severe |

### Efficiency Rating
| Rate | Color | Label |
|------|-------|-------|
| 80-100% | 🟢 Green | Excellent |
| 60-79% | 🟡 Yellow | Good |
| <60% | 🔴 Red | Needs Help |

### SLA Compliance
| Status | Color | Meaning |
|--------|-------|---------|
| ✓ COMPLIANT | 🟢 Green | All items <2d pending |
| ⚡ WARNING | 🟡 Yellow | Some violations (10-20%) |
| ⚠ CRITICAL | 🔴 Red | Many violations (>20%) |

---

## 🔍 How to Use the Dashboard

### Step 1: View Overview
Navigate to **Vendor Eval** page to see all vendor operations at a glance.

### Step 2: Identify Bottlenecks
Look at the **Bottleneck Alert** section (red highlight) for the most critical vendor operation.

### Step 3: Check Details
Review the **Process Cycle Time & Efficiency Table** for:
- Which vendors are slowest (highest aging)
- Which vendors have high SLA violation rates
- Which vendors have low completion rates

### Step 4: Drill Down
Scroll to the **Item-Level Tracking** table to:
- See specific items causing delays
- Check pending days for each item
- Monitor SLA compliance

### Step 5: Take Action
Based on findings:
- 🔴 **Red items (>7 days aging)**: Follow up immediately
- 🟡 **Yellow items (3-7 days)**: Check progress, provide support
- 🟢 **Green items (0-2 days)**: Monitor regularly

---

## 📋 Interpretation Guide

### High Cycle Time (>14 days)
**Indicator**: Vendor operation takes long time from PO to completion
**Action**: 
- Review process requirements
- Check for resource constraints
- Discuss optimization with vendor

### High SLA Violation Rate (>20%)
**Indicator**: Vendor consistently misses 2-day update intervals
**Action**:
- Increase monitoring frequency
- Request status updates more frequently
- Consider process changes

### Low Process Efficiency (<60%)
**Indicator**: Vendor is not completing items
**Action**:
- Investigate blockers
- Check for quality issues requiring rework
- Assess vendor capabilities

### High Bottleneck Score
**Indicator**: Critical vendor operation at risk
**Action**:
- Allocate additional resources
- Prioritize items in this stage
- Communicate urgency to vendor

---

## 🔧 Filter & Export

### Using Filters
1. Use the filter dropdown to select **"Vendor Only"** to see only vendor items
2. Filter by specific PO or Stage to drill down
3. Use search to find specific SCs or products

### Exporting Data
Click **"Export Data"** in Upload section to download current vendor metrics as Excel file for further analysis.

---

## 📊 Sample Metrics Reference

### Vendor Bottleneck Table Example
```
Vendor OP | Items | Avg Days | Efficiency | SLA Violations | Status
----------|-------|----------|------------|----------------|--------
SDV       | 8     | 5d       | 62%        | 3              | ⚡ WARNING
BLV       | 12    | 7d       | 58%        | 5              | ⚠ CRITICAL
HOV       | 4     | 2d       | 100%       | 0              | ✓ COMPLIANT
HCV       | 2     | 9d       | 50%        | 2              | ⚠ CRITICAL
```

---

## 🚀 Key Takeaways

✅ **Aging**: Identifies stalled items using today - last_update  
✅ **SLA**: >2 days = RED VIOLATION for immediate action  
✅ **Cycle Time**: Tracks total time from PO receipt  
✅ **Efficiency**: Measures % of completed items  
✅ **Bottleneck**: Weighted score combining duration + volume  
✅ **Actionable**: Color-coded status for quick decisions  

---

## 📞 Support

For issues or questions about the vendor metrics:
1. Check that timestamps are in format: `YYYY-MM-DD HH:MM:SS`
2. Ensure PO dates are in format: `YYYY-MM-DD`
3. Verify vendor items have `inhouse = "VENDOR"`
4. Check that vendor items have a `currentStage` value

Last Updated: April 2026
Version: 2.0
