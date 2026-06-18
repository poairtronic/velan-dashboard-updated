# Forecast Validation Report: Phase 11 Refinements

This report validates the transition of the **Manufacturing Intelligence Center** forecasting engines from the legacy algorithms to the **Phase 11 (V2) Refinements**. These modifications improve the operational realism, stability, and predictive accuracy of the capacity planner, queue forecasts, SLA delay models, and vendor risk analyses.

---

## 1. Core Engine Advancements

| Vector / Metric | Legacy Engine | Refined V2 Engine | Impact on Accuracy & Operational Realism |
| :--- | :--- | :--- | :--- |
| **Transition Key** | `SC + Product` | `SC + PO + Product` | **Prevents cross-contamination**: By separating individual purchase orders, flows for different orders of the same product do not blend. Distinct PO batches are tracked independently. |
| **Calendar Mode** | Standard Calendar (7 Days/Week) | Working-Day Calendar (5 Days Mon–Fri) | **Removes weekend distortions**: Legacy calculations assumed production on Saturdays/Sundays. The V2 engine aligns projections with the shop floor's 5-day working week. |
| **Throughput Model** | Simple 14/30-day Averages | Weighted Throughput (70% Recent / 30% Previous) | **Responsive to recent trends**: Rapid changes in throughput (e.g., machinery breakdown, shift increases) are captured promptly rather than being diluted by old data. |
| **Confidence Score** | Binary/Simple Activity-based | CV-based V2 Score (60% Activity / 40% Consistency) | **Filters out erratic behaviour**: High-volume but highly inconsistent stages get lower confidence scores. Measures process stability using Coefficient of Variation ($CV = \sigma / \mu$). |

---

## 2. Transition Key Comparison

### Legacy: SC + Product
When multiple Purchase Orders (POs) shared the same Service Card (SC) and Product:
- Exit transitions from one PO were falsely registered as throughput for other POs.
- Led to highly optimistic queue clearance estimates because the historical throughput count was artificially inflated by double-counting.

### Refined: SC + PO + Product
- **Granular Tracking**: Each tuple of `SC + PO + Product` represents a single unique batch of physical items moving through the shop floor.
- **Data Integrity**: Outflows are recorded only when the *exact* item batch leaves a stage, eliminating duplicate count anomalies.

---

## 3. Working-Day Calendar Implementation

The 5-day Working Day Calendar excludes Saturdays, Sundays, and the following predefined company holidays:
- **Holidays**: New Year's Day, Pongal, Thiruvallur Day, Kanum Pongal, Republic Day, Tamil New Year Day, May Day, Independence Day, Vinayagar Chaturthi, Gandhi Jayanthi, Ayudha Pooja, Diwali.

### Projections Math
- **Legacy Calendar Projections**:
  $$\text{Projected Date} = \text{Today} + \text{Remaining Days}$$
- **V2 Working Day Projections**:
  $$\text{Projected Date} = \text{addWorkingDays5Day}(\text{Today}, \text{Remaining Working Days})$$
  *(Automatically rolls over weekends and holidays, presenting the realistic date when staff are on-site).*

---

## 4. Weighted Throughput Model & Confidence V2

### Weighted Throughput Formula
Over a 14-day analysis window:
- **Recent Period** ($R$): Days 0 to 6 (7 working days)
- **Previous Period** ($P$): Days 7 to 13 (7 working days)

$$\text{Weighted Outflow} = (\text{Outflow}_R \times 0.7) + (\text{Outflow}_P \times 0.3)$$
$$\text{Weighted Daily Outflow Rate} = \frac{\text{Weighted Outflow}}{7}$$

### Confidence Score V2 Formula
The confidence percentage is a linear combination of two dimensions:
1. **Activity Score** ($A$): Percentage of working days in the analysis window containing at least one transition.
   $$A = \frac{\text{Days with Activity}}{W}$$
2. **Consistency Score** ($C$): Derived from the Coefficient of Variation ($CV$) of daily throughput.
   $$CV = \frac{\sigma}{\mu} = \frac{\text{Standard Deviation of Daily Outflows}}{\text{Mean Daily Outflow}}$$
   $$C = \max(0, 1 - CV)$$
   *(Note: If Mean Daily Outflow is 0, $C = 0$)*

$$\text{Confidence Score} = (A \times 0.6) + (C \times 0.4)$$

---

## 5. Sample Calculation Walkthrough

Let's assume a stage **"MACHINING"** currently has a queue of **50 items**.
The history over the last 14 working days is as follows:
- **Recent 7 Days Outflow**: `[5, 4, 6, 0, 5, 5, 5]` (Total = 30; Days active = 6/7)
- **Previous 7 Days Outflow**: `[2, 3, 2, 2, 3, 2, 2]` (Total = 16; Days active = 7/7)

### Step 5.1: Weighted Throughput
- $\text{Outflow}_R = 30$
- $\text{Outflow}_P = 16$
- $\text{Weighted Outflow} = (30 \times 0.7) + (16 \times 0.3) = 21 + 4.8 = 25.8$
- $\text{Weighted Daily Outflow Rate} = 25.8 / 7 = 3.69 \text{ items/day}$
- *(Legacy calculation would simply do: $(30 + 16) / 14 = 3.29 \text{ items/day}$. The V2 rate is higher because it weights the recent productivity boost at 70%)*

### Step 5.2: Confidence Score V2
- **Activity**: Out of 14 working days, 13 had transitions.
  $$A = 13 / 14 = 0.9286 \ (92.8\%)$$
- **Consistency**:
  - Daily outflow array: `[5, 4, 6, 0, 5, 5, 5, 2, 3, 2, 2, 3, 2, 2]`
  - $\mu = 46 / 14 = 3.2857$
  - Variance:
    $$\sigma^2 = \frac{\sum (x_i - \mu)^2}{14} \approx 2.7755$$
    $$\sigma \approx 1.666$$
  - Coefficient of Variation ($CV$):
    $$CV = \frac{1.666}{3.2857} \approx 0.507$$
  - Consistency Score ($C$):
    $$C = 1 - 0.507 = 0.493$$
- **Final Confidence %**:
  $$\text{Confidence} = (0.9286 \times 0.6) + (0.493 \times 0.4) \approx 0.557 + 0.197 = 0.754 \ (75.4\% \to 75\%)$$

---

## 6. Component Validation Details

### 6.1 Dynamic Capacity Planner
- **Dashboard Representation**: Displays weighted inflow/outflow, net change per day, and projected queue sizes at +7, +14, and +30 working days.
- **Accuracy Improvement**: Prevents infinite queue projections because it utilizes weighted recent rates, resolving cases where a recent throughput acceleration has already corrected a bottleneck.

### 6.2 Queue Clearance Forecast
- **Dashboard Representation**: Renders Best, Expected, and Worst Case scenarios alongside the calculated calendar date.
- **Accuracy Improvement**: Exposing the `expectedClearanceDate` using `addWorkingDays5Day` ensures that the date reported on the UI is highly realistic and maps directly to work week intervals.

### 6.3 SLA Forecast Panel
- **Dashboard Representation**: Columns for current PO age, expected completion date, expected delay days, and delay probability.
- **Accuracy Improvement**: Projections factor in both current stage durations and the queue sizes of preceding stages.

### 6.4 Vendor Risk Matrix
- **Dashboard Representation**: Displays throughput trends, delay trends, stability scores, risk levels, and confidence.
- **Accuracy Improvement**: Stability scores ($100 - CV \times 100$) allow planners to easily distinguish between a vendor who delivers consistently and one who is erratic.

### 6.5 Predictive Bottleneck Detection
- **Dashboard Representation**: Displays Current Bottleneck (Throughput Trend, Queue Growth) and Predicted Next Bottleneck (Projected Queue Size, Projected Delay, Forecast Confidence).
- **Accuracy Improvement**: By tracking the growth rate of queues across stages, the system can alert management of downstream bottlenecks *before* they manifest physically.
