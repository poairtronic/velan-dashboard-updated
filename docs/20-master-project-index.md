# 20 - Master Project Index & Documentation Map

## 1. Project Master Summary

The **Velan Metrology Production Command Center** is a full-stack, enterprise-grade manufacturing analytics and shop-floor intelligence platform. It bridges distributed spreadsheet tracking with a robust cloud backend (PostgreSQL + Redis) and a reactive React 18 frontend to deliver real-time operational visibility, predictive bottleneck forecasting, and automated raw-material cutting inventory management.

---

## 2. Documentation Map & Navigation Guide

```
                         ┌────────────────────────────────────┐
                         │   20-master-project-index.md       │
                         │          (Start Here)              │
                         └─────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ 01-project-      │             │ 02-project-      │             │ 03-tech-stack.md │
│ overview.md      │             │ architecture.md  │             │                  │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
                                          ▼
                         ┌────────────────────────────────────┐
                         │ 04-data-source-and-excel.md        │
                         └─────────────────┬──────────────────┘
                                           │
                                           ▼
                         ┌────────────────────────────────────┐
                         │ 05-data-flow.md                    │
                         └─────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
         ▼                                                                   ▼
┌────────────────────────────────────┐             ┌────────────────────────────────────┐
│ 06-backend-and-api.md              │             │ 07-frontend-and-dashboard.md       │
└────────────────┬───────────────────┘             └────────────────┬───────────────────┘
                 │                                                  │
                 └─────────────────────────┬────────────────────────┘
                                           │
                                           ▼
                         ┌────────────────────────────────────┐
                         │ 08-business-logic-and-             │
                         │ calculations.md                    │
                         └─────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ 09-auth-and-     │             │ 10-config-and-   │             │ 11-deployment.md │
│ security.md      │             │ environment.md   │             │                  │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ 12-file-and-     │             │ 13-external-     │             │ 14-testing.md    │
│ function-ref.md  │             │ integrations.md  │             │                  │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ 15-performance.md│             │ 16-known-issues- │             │ 17-change-impact-│
│                  │             │ tech-debt.md     │             │ map.md           │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
                                          ▼
                         ┌────────────────────────────────────┐
                         │ 18-developer-guide.md              │
                         │ 19-ai-agent-context.md             │
                         └────────────────────────────────────┘
```

---

## 3. Complete Documentation Table of Contents

1. [**01-project-overview.md**](./01-project-overview.md): Executive summary, business problems solved, user personas, and high-level value creation.
2. [**02-project-architecture.md**](./02-project-architecture.md): Overall system architecture, frontend context hierarchy, Express routing, and caching strategy.
3. [**03-tech-stack.md**](./03-tech-stack.md): Complete technology inventory (React, Vite, Node, Express, PostgreSQL, Upstash Redis, BullMQ, TailwindCSS, Chart.js) and technical justifications.
4. [**04-data-source-and-excel.md**](./04-data-source-and-excel.md): Deep-dive into Google Sheets, merged-cell job cards, column aliases, stage normalizers, and SheetJS date parsing.
5. [**05-data-flow.md**](./05-data-flow.md): End-to-end trace from source spreadsheet $\to$ normalization $\to$ BullMQ worker $\to$ Neon PostgreSQL $\to$ WebSocket broadcast $\to$ React Query UI render.
6. [**06-backend-and-api.md**](./06-backend-and-api.md): Complete catalog of all 23 backend API modules, methods, request schemas, parameters, and response structures.
7. [**07-frontend-and-dashboard.md**](./07-frontend-and-dashboard.md): Guide to all 20 dashboard pages (Overview, War Room, MIC, Predictive Analytics, Inventory, etc.) and global UI components.
8. [**08-business-logic-and-calculations.md**](./08-business-logic-and-calculations.md): Exact mathematical formulas for working days (skipping Sundays and 12 holidays), OTD %, bottleneck scores, vendor SLA violations, MIC health index, and predictive SLA delays.
9. [**09-authentication-and-security.md**](./09-authentication-and-security.md): JWT HttpOnly cookie authentication, RBAC permissions, SSRF whitelist validation, CSP/HSTS headers, and audit logging.
10. [**10-configuration-and-environment.md**](./10-configuration-and-environment.md): Zod-validated environment variables (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, etc.) with template `.env`.
11. [**11-deployment.md**](./11-deployment.md): Build lifecycle, reverse proxy configuration, SSL termination, and Render deployment specifications.
12. [**12-file-and-function-reference.md**](./12-file-and-function-reference.md): Detailed reference manual of core backend services, utilities, database helpers, and frontend hooks.
13. [**13-external-integrations.md**](./13-external-integrations.md): Integration details for Google Sheets (Web CSV), Neon Serverless PostgreSQL, Upstash Redis, Sentry, and LogRocket.
14. [**14-testing.md**](./14-testing.md): Vitest and React Testing Library setup, test commands, coverage inventory, and authoring guidelines.
15. [**15-performance.md**](./15-performance.md): GIN trigram indexing, server-side pagination, virtualized table rendering (`react-window`), caching, and scalability analysis.
16. [**16-known-issues-and-technical-debt.md**](./16-known-issues-and-technical-debt.md): Analysis of confirmed technical debt, legacy state references, and future optimization opportunities.
17. [**17-change-impact-map.md**](./17-change-impact-map.md): Downstream dependency guide for adding spreadsheet columns, modifying SLA targets, adding KPIs, or altering inventory models.
18. [**18-developer-guide.md**](./18-developer-guide.md): Local development setup, npm scripts, coding conventions, and contribution guidelines for human engineers.
19. [**19-ai-agent-context.md**](./19-ai-agent-context.md): Dedicated context summary, pre-flight checklist, and precise file sequence guide for future AI coding agents.
20. [**20-master-project-index.md**](./20-master-project-index.md): Master landing document and cross-linked architectural directory.
21. [**21-velan-excel-data-dictionary.md**](./21-velan-excel-data-dictionary.md): Comprehensive dictionary for Columns A–L, data types, normalizations, and spreadsheet layout.
22. [**22-production-workflow.md**](./22-production-workflow.md): Complete manufacturing lifecycle, stage catalog, inhouse vs vendor operations, and stage aging thresholds.
23. [**23-po-sc-product-hierarchy.md**](./23-po-sc-product-hierarchy.md): PO -> SC -> Product entity relationships, matched set integrity, and multi-level completion formulas.
24. [**24-status-operation-mapping.md**](./24-status-operation-mapping.md): 3-tier cascade stage resolver, regex extraction, typo dictionaries, and vendor suffix rules.
25. [**25-dashboard-metric-data-lineage.md**](./25-dashboard-metric-data-lineage.md): End-to-end data lineage table tracing Excel columns to backend services, API routes, and React UI cards.
26. [**26-real-world-business-rules.md**](./26-real-world-business-rules.md): Formal business rules catalog, SLA triggers, inventory concurrency rules, and management verification register.

---

## 4. Quick Reference Key Indicators

- **Database:** PostgreSQL (Neon) with 16 core tables and GIN Trigram full-text search indexes.
- **Cache:** Upstash Redis with 300s TTL for aggregated dashboard queries.
- **Task Queue:** BullMQ with `syncQueue` (data ingestion) and `exportQueue` (PDF/CSV/JSON report generation).
- **Working Calendar:** 6-day work week (Monday–Saturday) with 12 predefined regional company holidays.
- **SLA Target:** 21 working days from `poDate` (Inhouse), 2 working days (Subcontract Vendor).
- **Primary Entry Points:**
  - Backend: `server.js` $\to$ `src/server/server.js` $\to$ `src/server/app.js`
  - Frontend: `index.html` $\to$ `src/main.jsx` $\to$ `src/App.jsx`
