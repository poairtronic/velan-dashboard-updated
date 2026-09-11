# 07 - Frontend & Dashboard Guide

## 1. Frontend Architecture & Page Directory

The frontend is a single-page application built on **React 18** and **Vite**, featuring 20 purpose-built views accessible via the persistent sidebar.

---

## 2. Comprehensive Page Catalog

### 2.1 Executive & Intelligence Views
1. **Overview Page (`src/pages/OverviewPage.jsx`):**
   - **Purpose:** Primary plant summary card grid and charts.
   - **Key Components:** 8 KPI summary cards (Total Items, Ready, Stores, WIP, Inhouse, Vendor, On-Time, Delayed), Daily Output Line Chart, Inhouse vs Vendor Distribution Doughnut, Stage Queue Bar Chart, Delayed POs Modal, and In-Progress POs Modal.
2. **Executive War Room (`src/pages/ExecutiveWarRoom.jsx`):**
   - **Purpose:** Fast-decision dashboard for executive leadership.
   - **Key Components:** Critical Queue Alert Table ($\ge 20$ items), High-Risk PO aging list ($>14$ days), and automated Priority Action Center cards.
3. **Manufacturing Intelligence Page (`src/pages/ManufacturingIntelligencePage.jsx`):**
   - **Purpose:** Advanced shop-floor analytics and composite health indicators.
   - **Key Components:** Composite Plant Health Index (0–100 gauge), Weekly/Monthly Throughput Velocity, Queue Clearance Horizon Table, Advanced Predictive Delay List, Root Cause Impact Cards, and Executive Action Recommendations.
4. **Predictive Analytics Page (`src/pages/PredictiveAnalyticsPage.jsx`):**
   - **Purpose:** Standalone tabbed workspace housing isolated forecast engines.
   - **Key Components:** `SLAForecastPanel`, `CapacityPlanner`, `QueueForecastCard`, `VendorRiskMatrix`, `BottleneckForecast`, and `PlantRiskDashboard`.

### 2.2 Operational & Machine Tracking Views
5. **Production Page (`src/pages/ProductionPage.jsx`):**
   - **Purpose:** Deep-dive into active shop-floor operations.
   - **Key Components:** Stage breakdown list, Inhouse/Vendor distribution metrics, active job list with stage badges, and daily throughput tracking.
6. **WIP Page (`src/pages/WIPPage.jsx`):**
   - **Purpose:** Dedicated work-in-progress monitoring across machines.
   - **Key Components:** WIP volume by machine category, aging breakdown, and active items list filtered by operational station.
7. **Bottleneck Page (`src/pages/BottleneckPage.jsx`):**
   - **Purpose:** Identifies machine backlogs causing delivery delays.
   - **Key Components:** Top bottleneck indicator card, stage bottleneck severity ranking table ($Queue \times Duration$), and delayed PO list sorted by days pending.
8. **Cycle Time Page (`src/pages/CycleTimePage.jsx`):**
   - **Purpose:** Measures manufacturing lead times across process stages.
   - **Key Components:** Average overall cycle time (working days), stage-by-stage average duration chart, and average days required to reach each intermediate stage.
9. **Vendor Page (`src/pages/VendorPage.jsx`):**
   - **Purpose:** Comprehensive sub-contractor monitoring.
   - **Key Components:** Vendor bottleneck alert, sub-contractor volume distribution chart, vendor time-ranking table, and SLA violation analysis table ($>2$ days aging).
10. **PO Page (`src/pages/POPage.jsx`):**
    - **Purpose:** Purchase-order-centric tracking.
    - **Key Components:** PO completion status list, elapsed working days vs. 21-day target, on-time delivery flags, and associated SC child items list.
11. **SC Page (`src/pages/SCPage.jsx`):**
    - **Purpose:** Sales Confirmation gauge set monitoring.
    - **Key Components:** Grouping of multiple gauge items under parent SC numbers, ready set indicators, and set completion trackers.
12. **Month / Day Output Page (`src/pages/MonthDayPage.jsx`):**
    - **Purpose:** Historical calendar analysis of output rates.
    - **Key Components:** Monthly output trends, daily output histograms for Ready vs. Stores items, and week-over-week comparison tables.

### 2.3 Inventory, Data & Administration Views
13. **Inventory Page (`src/pages/InventoryPage.jsx`):**
    - **Purpose:** Raw material cutting and fine blank production management.
    - **Key Components:** Raw Long Bar Stock table, Cut Piece Definitions modal, Atomic Cutting dialog with bar reduction simulation, Fine Blank Master table, Fine Blank Stamping modal, and production history logs.
14. **Database Page (`src/pages/DatabasePage.jsx`):**
    - **Purpose:** High-speed exploration of the entire multi-thousand-row archive.
    - **Key Components:** `DatabaseFilterBar`, `DatabaseKPIs`, `VirtualizedTable` for smooth scrolling over 50,000+ records, and asynchronous PDF/CSV/JSON export buttons.
15. **Upload / Import Page (`src/pages/UploadPage.jsx`):**
    - **Purpose:** Data ingestion hub for live synchronization and manual file uploads.
    - **Key Components:** Live Google Sheets URL configuration & manual sync trigger, drag-and-drop Excel/CSV upload zones, historical database append/replace options, and full database reset controls (Admin only).
16. **Audit Trail Viewer (`src/pages/AuditTrailViewer.jsx` - Admin only):**
    - **Purpose:** Immutable compliance and activity log.
    - **Key Components:** Filterable table displaying user logins, data syncs, exports, and configuration modifications with IP addresses and timestamps.
17. **User Management Page (`src/pages/UserManagementPage.jsx` - Admin only):**
    - **Purpose:** Role-based access control and approval workflow.
    - **Key Components:** Pending user approval/rejection table, active users list, role promotion/demotion (`admin` vs `user`), and direct user creation.
18. **Enterprise Health Page (`src/pages/EnterpriseHealthPage.jsx`):**
    - **Purpose:** Infrastructure and API telemetry dashboard.
    - **Key Components:** Neon PostgreSQL status, Upstash Redis connectivity, API latency percentiles (p50, p95, p99), cache hit ratio charts, and WebSocket connection monitor.
19. **Login Page (`src/pages/LoginPage.jsx`):**
    - **Purpose:** User authentication and registration.
    - **Key Components:** JWT login form, new account registration request, password toggle, and legacy admin/user credential fallbacks.

---

## 3. Global UI Controls & Interaction Components

### 3.1 Filter Bar (`src/components/FilterBar.jsx`)
Appears across operational dashboard pages and provides real-time client/server filtering:
- **Search:** Debounced substring search matching `sc`, `po`, or `product`.
- **Dropdowns:** Filter by PO Number, Production Stage, Product Type (`APG`, `ARG`, `SPG`, `SRG`, `SP`, `ACCESSORY`), and Inhouse/Vendor location.
- **Date Picker:** Date range selection (`fromDate`, `toDate`) applied against either `poDate` or `timestamp`.
- **Data Source Switch:** Toggles between `'live'` (active shop floor snapshot) and `'database'` (entire historical archive).

### 3.2 Command Palette (`src/components/CommandPalette.jsx`)
- Activated by pressing `Ctrl + K` (Windows/Linux) or `Cmd + K` (macOS).
- Provides instant fuzzy-search navigation across all 20 pages, common actions (Sync Live, Upload Data, Clear Filters), and filtered jump-to-page shortcuts.

### 3.3 Real-Time Notification & Alert System
- Active alerts generated by the backend Alert Engine are displayed in the Header notification drawer (`src/components/Header.jsx`).
- Users can acknowledge alerts or mark them as read in bulk, updating the database via `PUT /api/alerts/read` with instant WebSocket state synchronization.
