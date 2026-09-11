# 08 - Business Logic & Calculations

## 1. Overview of Manufacturing Business Rules

All mathematical calculations, holiday adjustments, and statistical models are standardized in:
- `src/utils/calculationUtils.cjs` (Frontend and backend shared utilities)
- `src/server/services/` (Core calculation engines)
- `src/server/forecast/` (Predictive forecasting algorithms)

---

## 2. Comprehensive Calculation Catalog

### 2.1 Working Days Calculation (Excluding Sundays & 12 Holidays)
- **File:** `src/utils/calculationUtils.cjs`
- **Function:** `workingDaysBetween(d1Str, d2Str)`
- **Purpose:** Counts only active manufacturing production days between two calendar dates.
- **Rules:**
  1. Skips all Sundays (`cur.getDay() === 0`).
  2. Skips 12 official company holidays:
     - `2026-01-01` (New Year's Day)
     - `2026-01-15` (Pongal)
     - `2026-01-16` (Thiruvallur Day)
     - `2026-01-17` (Kanum Pongal)
     - `2026-01-26` (Republic Day)
     - `2026-04-14` (Tamil New Year)
     - `2026-05-01` (May Day)
     - `2026-08-15` (Independence Day)
     - `2026-09-14` (Vinayagar Chaturthi)
     - `2026-10-02` (Gandhi Jayanthi)
     - `2026-10-19` (Ayudha Pooja)
     - `2026-11-09` (Diwali)
  3. **Memoization:** Caches calculations in an LRU Map capped at 10,000 keys.

---

### 2.2 On-Time Delivery Rate (OTD %)
- **Files:** `src/server/services/kpiService.js`, `src/utils/calculationUtils.cjs`
- **Constant Target:** `TARGET_DAYS = 21` working days.
- **Formula:**
  $$\text{OTD \%} = \left( \frac{\text{Count of Completed POs with Elapsed Working Days} \le 21}{\text{Total Completed POs}} \right) \times 100$$
- **Completed PO Definition:** A PO where **every child item** has reached a terminal stage (`READY`, `STORES`, `STOCK`, `EXSTOCK`, or `VA`).
- **Delayed PO Definition:**
  - If completed: `workingDaysBetween(poDate, lastTimestamp) > 21`.
  - If in-progress: `workingDaysBetween(poDate, todayStr) > 21`.

---

### 2.3 Stage Bottleneck Severity Score
- **File:** `src/server/services/bottleneckService.js`
- **Formula:**
  $$\text{Bottleneck Score} = \text{Queue Count} \times \text{Duration}$$
  - Where `Queue Count` = Number of active items currently at that stage.
  - Where `Duration` = Vendor average pending days (if vendor stage) OR average stage duration from `cycleTimeService.js` (if inhouse stage).
- **Ranking:** Stages are sorted in descending order of score; the highest-scoring stage is flagged as the **Top Bottleneck**.

---

### 2.4 Stage Cycle Time & Duration Breakdown
- **File:** `src/server/services/cycleTimeService.js`
- **Logic:**
  1. Records belonging to the same SC are sorted chronologically by `timestamp`.
  2. For each transition from $Stage_i$ to $Stage_{i+1}$, the elapsed working days are computed:
     $$\Delta t = \text{workingDaysBetween}(Timestamp_i, Timestamp_{i+1})$$
  3. **Average Stage Duration:** Mean of all recorded transition durations for that stage.
  4. **Average Time-to-Reach Stage:** Mean working days from `poDate` to the stage's `timestamp`.

---

### 2.5 Vendor Performance & SLA Violation Rate
- **File:** `src/server/services/vendorService.js`
- **Threshold:** External vendor SLA limit = **2 working days**.
- **Calculations:**
  - **Vendor Aging:** `workingDaysBetween(timestamp, todayStr)`.
  - **SLA Violations:** Count of active items at the vendor with aging $>2$ working days.
  - **SLA Violation Rate:**
    $$\text{Violation Rate \%} = \left( \frac{\text{Vendor Items} > 2\text{ Days}}{\text{Total Vendor Items}} \right) \times 100$$
  - **Vendor Efficiency Score:**
    $$\text{Efficiency} = 100 - \min\left(100, \frac{\text{Average Pending Days}}{21} \times 100\right)$$

---

### 2.6 Manufacturing Intelligence Center (MIC) Health Index
- **File:** `src/server/services/micService.js`
- **Formula:**
  $$\text{Plant Health Score} = \frac{\text{Production} + \text{Delivery} + \text{Vendor} + \text{Inventory} + \text{Flow}}{5}$$
  - **Production Score:** Weekly throughput stability ratio $(\frac{\text{Throughput}_{\text{current}}}{\text{Throughput}_{\text{last}}} \times 100)$.
  - **Delivery Score:** Current On-Time Delivery percentage (OTD %).
  - **Vendor Score:** Mean efficiency score across all active sub-contractor vendors.
  - **Inventory Score:** Percentage of stock that is active ($\le 30$ days age) vs dead ($>30$ days age).
  - **Flow Score:** Inverse of top bottleneck impact score ($100 - \text{Top Bottleneck Severity}$).

---

### 2.7 Predictive SLA & Breach Delay Engine
- **File:** `src/server/forecast/slaEngine.js`
- **Inputs:** Open POs, historical PO type velocities ($V_{\text{type}}$), active stage queues ($Q_{\text{stage}}$), weighted throughput ($T_{\text{stage}}$).
- **Formulas:**
  $$\text{Queue Delay} = \frac{Q_{\text{stage}}}{T_{\text{stage}}}$$
  $$\text{Queue Impact} = \min\left(0.5, \frac{\text{Queue Delay}}{\text{Projected Total Days}}\right)$$
  $$\text{Adjusted Total Duration} = V_{\text{type}} \times (1 + \text{Queue Impact})$$
  $$\text{Expected Remaining Days} = \max(1, \text{Adjusted Duration} - \text{Elapsed Days})$$
  $$\text{Projected Completion Date} = \text{addWorkingDays5Day}(\text{Today}, \text{Expected Remaining Days})$$
  $$\text{Delay Probability} = \min\left(99, \max\left(5, \left(\frac{\text{Total Estimated Days}}{21} - 0.6\right) \times 200\right)\right)$$

---

### 2.8 Queue Clearance Horizon Forecast
- **File:** `src/server/forecast/queueForecast.js`
- **Formula:**
  $$\text{Weighted Outflow} = (\text{Outflow}_{\text{recent 7 days}} \times 0.7) + (\text{Outflow}_{\text{previous 7 days}} \times 0.3)$$
  $$\text{Average Daily Throughput } (T_{\text{daily}}) = \frac{\text{Weighted Outflow}}{7}$$
  $$\text{Days to Clear Queue} = \frac{\text{Current Stage Queue Size}}{T_{\text{daily}}}$$
  $$\text{Expected Clearance Date} = \text{addWorkingDays5Day}(\text{Today}, \text{Days to Clear})$$
