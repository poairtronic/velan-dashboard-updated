# 01 - Project Overview

## 1. Executive Summary

### One-Sentence Summary
The **Velan Metrology Production Command Center** is a real-time industrial manufacturing intelligence dashboard that ingests shop-floor job-tracking data from live Google Sheets and historical Excel datasets into PostgreSQL (Neon), computes operational cycle times, bottlenecks, SLA delays, and cutting inventory metrics, and presents them across 20 reactive analytical views for plant executives and production engineers.

### One-Paragraph Summary
Velan Metrology manufactures precision gauging instruments, air plugs, master rings, and custom metrology accessories. Daily shop-floor movements (across turning, milling, heat treatment, grinding, sub-contract vendor operations, inspection, and stores) are tracked in spreadsheet logs. The Velan Dashboard automatically synchronizes with these live spreadsheets, normalizes complex job transitions, eliminates duplicate records using cryptographic MD5 hashing, and stores data in a high-performance Neon PostgreSQL database with Upstash Redis caching. It equips operations managers with real-time on-time delivery (OTD) tracking, 14-day bottleneck forecasts, predictive SLA breach alerts, root cause impact analytics, and atomic raw-material cutting inventory management.

---

## 2. Business Purpose & Problem Statement

### The Problem It Solves
Traditional precision manufacturing facilities suffer from data fragmentation and delayed reporting:
1. **Spreadsheet Silos:** Production operators log daily movements across shared spreadsheets, resulting in inconsistent stage naming, accidental overwrites, and lack of historical versioning.
2. **Delayed Visibility into Bottlenecks:** Line managers discover that an order is delayed only after the delivery date has passed, rather than identifying accumulating queues at critical machines (e.g., Lathe, Cylindrical Grinding) or sub-contract vendors (e.g., Heat Treatment, Special Plating).
3. **Complex Calculation Overhead:** Computing true working-day cycle times requires adjusting for Sundays and 12 distinct regional/company holidays, calculating vendor aging days, and grouping multiple product components under single Sales Confirmation (SC) sets.
4. **Raw Material Tracking Gaps:** Bar-cutting operations risk material loss and stock discrepancies if dimension deductions from long bars are tracked manually without atomic inventory locking.

### Who Uses It?
- **Executive Leadership (Managing Director, Plant Head):** Uses the *Executive War Room* and *Manufacturing Intelligence Center* to view the composite Plant Health Score (0–100), overall throughput velocity, and priority corrective actions.
- **Production Managers & Line Supervisors:** Use the *Overview*, *Production*, *WIP*, *Bottleneck*, and *Cycle Time* pages to track job card movements through internal stages and expedite stalled orders.
- **Vendor & Supply Chain Coordinators:** Use the *Vendor Page* and *Vendor Risk Matrix* to monitor third-party sub-contractors, identify aging jobs (>2 days at vendor), and calculate SLA compliance rates.
- **Inventory & Store Managers:** Use the *Inventory Page* and *Cutting Dashboard* to manage raw long bars, define cut pieces, perform atomic cutting operations, produce fine blanks, and review dead stock aging (>30 days).
- **System Administrators & Quality Auditors:** Use the *Audit Trail Viewer*, *Enterprise Health*, and *User Management* to inspect immutable audit logs, review API latency percentiles (p50/p95/p99), and manage user access permissions.

---

## 3. Data Transformation & Value Creation

```
┌────────────────────────────────────────────────────────┐
│             Shop Floor Operators                       │
│ Log daily movements in Google Sheets / Excel Spreadsheets│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Ingestion & Normalization                  │
│  - Automated HTTP background polling (useLiveSync)     │
│  - SSRF-whitelisted proxy (/api/sheets)                │
│  - Aliases mapped: PO_NO, SC_NO, OP_STAGE, INHOUSE     │
│  - MD5 deduplication hash & Neon PostgreSQL upsert     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Analytical Intelligence Engines            │
│  - 6-day Working Calendar (skips Sun + 12 Holidays)   │
│  - 21-day Standard SLA Target vs. Elapsed Working Days │
│  - Weighted Outflow Velocity & Queue Clearance         │
│  - Vendor SLA Violations (>2 days aging)               │
│  - Concurrency-controlled Raw Material Cutting Engine  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Decisions Enabled on Dashboard             │
│  - Reallocate machine operator capacity to bottlenecks │
│  - Expedite high-risk POs before 21-day SLA breaches   │
│  - Renegotiate sub-contractor supplier agreements      │
│  - Prevent raw bar stock depletion during cutting      │
└──────────────────────────┘
```

---

## 4. Key Metrics & Information Provided

1. **On-Time Delivery (OTD %):** Percentage of completed Purchase Orders finished within the 21-working-day target from `poDate`.
2. **WIP Breakdown:** Live count of in-progress items distributed across Inhouse stations and External Vendors.
3. **Stage Queue & Bottleneck Severity:** Queue count $\times$ average duration per stage, ranking active bottlenecks and predicting the next shift bottleneck at +14 days.
4. **Vendor SLA Compliance:** Percentage of items returned by external sub-contractors within 2 working days.
5. **Plant Health Composite Score (0–100):** Weighted composite index derived from Production Stability, Delivery Performance, Vendor Health, Inventory Velocity, and Shop Flow.
6. **Raw Material Utilization:** Current bar stock remaining lengths, cut piece inventory, fine blank availability, and complete historical cut logs.
