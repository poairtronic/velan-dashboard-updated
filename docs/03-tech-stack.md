# 03 - Technology Stack

## 1. Complete Technology Inventory

| Layer | Technology | Version | Purpose | Usage Location |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.2.0` | Declarative component UI rendering | `src/`, `src/pages/`, `src/components/` |
| **Build Tool & Bundler** | Vite | `^5.0.0` | Fast HMR and optimized production bundling | `vite.config.mjs`, `index.html` |
| **Data Fetching / Cache**| TanStack React Query | `^5.101.0`| Client-side caching, auto-refetching, and state management | `src/context/DataContext.jsx`, `src/hooks/` |
| **Routing** | React Router DOM | `^7.17.0` | Client-side SPA route navigation and guards | `src/App.jsx`, `src/components/ProtectedRoute.jsx` |
| **CSS Framework** | Tailwind CSS | `^3.4.19` | Utility-first styling and theme styling | `tailwind.config.js`, `src/assets/styles.pcss` |
| **Icons** | Lucide React | `^1.20.0` | Modern SVG iconography | `src/components/`, `src/pages/` |
| **Charts & Visualizations**| Chart.js | `^4.4.1` | Canvas-based bar, line, doughnut, and radar charts | `src/components/`, `src/pages/` |
| **Virtual Scrolling** | React Window | `^1.8.10` | High-performance virtualized rendering for 10k+ table rows | `src/components/ui/VirtualizedTable.jsx` |
| **Toast Notifications** | React Hot Toast | `^2.6.0` | Non-blocking user alerts and sync status feedback | `src/context/DataContext.jsx`, `src/hooks/` |
| **Error Boundary** | React Error Boundary | `^6.1.2` | Component crash protection and fallback UI | `src/components/ErrorBoundary.jsx`, `src/components/common/` |
| **Client Monitoring** | Sentry React | `^10.57.0`| Production error tracking and crash diagnostics | `src/utils/sentry.js` |
| **User Session Replay** | LogRocket | `^12.1.1` | Session replay and frontend telemetry | `src/utils/logrocket.js` |
| **PDF Generation** | jsPDF + AutoTable | `^2.5.1` / `^3.5.28` | Client and server-side PDF report compilation | `src/server/workers/exportWorker.js`, `src/pages/` |
| **Spreadsheet Parsing** | XLSX (SheetJS) | `^0.18.5` | Parsing uploaded Excel (.xlsx, .xls) files | `src/services/excelParser.js` |
| **Schema Validation** | Zod | `^4.4.3` | Schema validation for API payloads, env vars, and forms | `src/server/schemas/`, `src/server/config/env.js` |
| **Backend Runtime** | Node.js | `>=18.x` | Server-side JavaScript runtime | `server.js`, `src/server/` |
| **Backend Framework** | Express | `^5.2.1` | REST API routing and middleware pipeline | `src/server/app.js`, `src/server/routes/` |
| **Database Driver** | pg (node-postgres) | `^8.11.3` | Connection pooling and querying against PostgreSQL | `src/server/db/pool.js` |
| **Primary Database** | PostgreSQL (Neon Cloud) | `15 / 16` | Relational + JSONB database storage with Trigram indexing | Serverless Neon PostgreSQL instance |
| **In-Memory Cache & DR**| Upstash Redis REST / IORedis | `^1.38.0` / `^5.11.1` | Key-value caching for dashboard KPIs, exports, rate limits | `src/server/cache/` |
| **Background Queues** | BullMQ | `^5.78.0` | Asynchronous job queues for data sync and export generation | `src/server/queues/`, `src/server/workers/` |
| **Real-Time WebSockets**| ws | `^8.21.0` | Bidirectional real-time event broadcasting to clients | `src/server/utils/websocket.js`, `src/hooks/useWebSocket.js` |
| **Security & Auth** | JSON Web Token (jsonwebtoken) | `^9.0.3` | Signed access and refresh tokens | `src/server/middleware/auth.js`, `src/server/routes/auth.js` |
| **Password Hashing** | bcrypt | `^6.0.0` | One-way password hashing (10 salt rounds) | `src/server/routes/auth.js` |
| **Rate Limiting** | express-rate-limit + rate-limit-redis | `^8.5.2` / `^5.0.0` | IP and Redis-backed request rate limiting | `src/server/middleware/rateLimit.js` |
| **Cookie Parsing** | cookie-parser | `^1.4.7` | Parses HttpOnly JWT cookies | `src/server/app.js`, `src/server/middleware/auth.js` |
| **HTTP Logger** | morgan | `^1.11.0` | HTTP request logging for development | `src/server/middleware/requestLogger.js` |
| **Environment Config** | dotenv | `^17.4.2` | Loads environment variables from `.env` | `src/server/config/env.js` |
| **Unit & Integration Test**| Vitest + React Testing Library | `^4.1.8` / `^16.3.2` | Test execution, mocking, and coverage | `vitest.config.js`, `src/__tests__/` |
| **Code Quality** | ESLint + Prettier | `^8.57.1` / `^3.8.3` | Linting and code formatting | `.eslintrc.cjs`, `.prettierrc` |

---

## 2. Detailed Technology Breakdown & Justification

### 2.1 Why PostgreSQL + JSONB + pg_trgm?
- **Flexibility:** Manufacturing spreadsheets frequently introduce new columns or change headers. Storing rows in `data JSONB` prevents database migration downtime.
- **Search Performance:** The PostgreSQL `pg_trgm` extension creates GIN trigram indexes on `data->>'sc'`, `data->>'po'`, `data->>'product'`, and `data->>'currentStage'`, enabling sub-millisecond `ILIKE '%...%'` substring queries across 100,000+ historical rows.
- **ACID Inventory Locking:** The cutting inventory subsystem utilizes PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) inside atomic transactions to prevent double-cutting race conditions.

### 2.2 Why TanStack React Query + WebSockets?
- Traditional dashboards constantly poll backend servers every few seconds, generating thousands of redundant queries.
- Velan Dashboard pairs **React Query caching** (`staleTime: 60000ms`) with **WebSocket push invalidation** (`sync:completed`). When new spreadsheet data is uploaded or synchronized, the backend broadcasts a lightweight event that causes React Query to revalidate only active components instantly.

### 2.3 Why BullMQ + Redis?
- Processing a large 50,000-row historical Excel upload or generating a 500-page PDF export can take several seconds.
- Offloading these operations to BullMQ workers (`syncWorker.js`, `exportWorker.js`) ensures the Express HTTP thread never blocks, keeping API response latency under 50ms for interactive dashboard users.
