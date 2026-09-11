# 14 - Testing Documentation

## 1. Testing Framework & Environment

The test suite is powered by **Vitest** (`^4.1.8`) and **React Testing Library** (`^16.3.2`), configured in `vitest.config.js` and `src/setupTests.js`.

### Test Configuration (`vitest.config.js`)
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    }
  }
});
```

---

## 2. Test Execution Commands

```bash
# Run full test suite once
npm test

# Run tests with interactive watch mode
npx vitest

# Run test coverage report
npm run test:coverage
```

---

## 3. Existing Test Inventory

| Test File Path | Test Type | Coverage Area | Description |
| :--- | :--- | :--- | :--- |
| `src/__tests__/utils/calculationUtils.test.js` | Unit Test | Business Logic & Calculations | Tests working days logic (skipping Sundays and 12 holidays), date parsing, OTD calculation, and product type inference. |
| `src/__tests__/components/ProtectedRoute.test.jsx` | Unit / Component Test | Routing & Auth Guards | Verifies redirection to `/login` when unauthenticated and blocks non-admin users from admin routes. |
| `src/__tests__/integration/ErrorBoundary.test.jsx` | Integration Test | Fault Tolerance | Simulates UI component rendering errors and verifies that `ErrorBoundary` catches crashes and renders fallback UI. |

---

## 4. Testing Guidelines for Future Developers

When extending the application, add tests adhering to these conventions:
1. **Unit Tests for Calculation Services:** Place in `src/__tests__/utils/` or `src/server/__tests__/`. Verify edge cases such as leap years, negative working days, and invalid date strings.
2. **API Route Tests:** Use `supertest` against `src/server/app.js` with `DATABASE_URL=mock` to test endpoint responses and schema validations without requiring a live PostgreSQL instance.
3. **Component Tests:** Wrap React components in `QueryClientProvider` and `MemoryRouter` to test rendering, user interactions, and filter changes.
