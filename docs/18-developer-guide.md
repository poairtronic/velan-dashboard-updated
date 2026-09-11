# 18 - Developer Onboarding & Contribution Guide

## 1. Local Development Setup

### 1.1 Prerequisites
- **Node.js:** `>= 18.x` (Recommended: `20.x` or `22.x`)
- **npm:** `>= 9.x`
- **PostgreSQL Database:** Neon Serverless PostgreSQL instance or local PostgreSQL (v14+)
- **Redis (Optional):** Upstash Redis account or local Redis server

### 1.2 Step-by-Step Installation
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd velan-dashboard-updated
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   Copy `.env.example` to `.env` and configure credentials:
   ```bash
   cp .env.example .env
   ```
   *For local development without a database, `DATABASE_URL=mock` enables in-memory mock testing.*

4. **Start local development servers:**
   - **Start Backend Server:**
     ```bash
     npm run start
     ```
     *Runs Express server at `http://localhost:10000`.*
   - **Start Frontend Vite Dev Server (in a separate terminal):**
     ```bash
     npm run dev
     ```
     *Runs Vite HMR server at `http://localhost:5173` (proxies API calls to port 10000).*

---

## 2. Common Development Scripts

| Command | Action | Description |
| :--- | :--- | :--- |
| `npm run dev` | Start Frontend | Starts Vite dev server with Hot Module Replacement (HMR). |
| `npm run start` | Start Backend | Starts Express backend server with database initialization and WebSockets. |
| `npm run build` | Production Build | Bundles and minifies React frontend into `dist/`. |
| `npm test` | Run Tests | Runs all Vitest unit and integration test suites. |
| `npm run test:coverage` | Test Coverage | Runs tests and generates a V8 coverage report in `coverage/`. |
| `npm run lint` | Lint Code | Runs ESLint across `src/` to identify style and syntax issues. |
| `npm run lint:fix` | Auto-fix Lints | Automatically fixes ESLint warnings and formatting. |
| `npm run format` | Format Code | Formats all code files using Prettier. |

---

## 3. Code Conventions & Best Practices

1. **Avoid Direct DOM Manipulation:** Use React state and Tailwind CSS classes.
2. **Handle Null / Undefined Safely:** Manufacturing spreadsheet rows frequently contain missing fields. Always use optional chaining (`row?.currentStage`) and fallback defaults.
3. **Use Shared Calculation Utilities:** Never reimplement working day differences or date formatting inline. Always import `workingDaysBetween`, `toIsoDateString`, and `normalizeStage` from `src/utils/calculationUtils.cjs` and `src/services/dataNormalizer.js`.
4. **Backend Transactions:** When performing multi-row mutations in PostgreSQL (especially in cutting inventory or bulk imports), always wrap operations in `client.query('BEGIN') ... client.query('COMMIT')` blocks with pessimistic locking (`FOR UPDATE`) where appropriate.
5. **Preserve Error Boundaries:** Wrap new UI page views in `<AppErrorBoundary>` to ensure a single component crash never causes a blank screen across the entire dashboard.
