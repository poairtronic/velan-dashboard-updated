# 09 - Authentication, Authorization & Security Analysis

## 1. Authentication Architecture

The application implements a secure, stateless, cookie-based **JSON Web Token (JWT)** session model paired with role-based access control (RBAC).

```
┌──────────────────────────────────────────────────────────────────┐
│                           Client Browser                         │
│ Sends credentials to POST /api/auth/login                        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Express Authentication Route                   │
│ 1. Checks bcrypt hash against `users` table                     │
│ 2. Verifies account status === 'approved'                        │
│ 3. Issues 2 signed HttpOnly Cookies:                             │
│    - `vd_token`: Access Token (15-min TTL, JWT_SECRET)           │
│    - `vd_refresh_token`: Refresh Token (7-day TTL, REFRESH_SECRET)│
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Subsequent Request Flow                        │
│ `middleware/auth.js:authenticate` intercepts cookies:            │
│  - If `vd_token` valid -> sets `req.user` -> next()              │
│  - If `vd_token` expired -> verifies `vd_refresh_token`          │
│    -> issues fresh `vd_token` cookie -> sets `req.user` -> next()│
│  - If both expired -> clears cookies -> returns 401 Unauthorized │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Roles, Permissions & Access Control

| Role | Status Required | Accessible Features & Routes |
| :--- | :--- | :--- |
| **`admin`** | Auto-approved / Approved | Full access to all 20 pages, Data Upload, Database Wipe & Reset (`/api/reset`), Database Migrations (`/api/migrate`), User Management (`/api/auth/users`), Audit Trail Logs (`/api/audit/history`), Alert Rule Modification (`/api/alerts/rules`), and Performance Telemetry (`/api/perf/report`). |
| **`user`** | `'approved'` | Read and interactive access to all operational dashboards (Overview, War Room, MIC, Predictive, Production, WIP, Bottleneck, Cycle Time, Vendor, PO, SC, Inventory, Database). Cannot perform database wipes, user management, or audit log inspection. |
| **`pending`**| Awaiting Admin Review | Blocked at login with HTTP 403: *"Waiting for admin approval."* |
| **`denied`** | Rejected by Admin | Blocked at login with HTTP 403: *"Your account request was denied by admin."* |

---

## 3. Security Mechanisms & Protections

### 3.1 Confirmed Security Mechanisms
1. **HttpOnly & Secure Cookies:** Authentication tokens are stored in `HttpOnly`, `Secure: true`, `SameSite: Lax` cookies, protecting against Cross-Site Scripting (XSS) token theft.
2. **SSRF Prevention on Google Sheets Proxy:**
   - Location: `src/server/utils/helpers.js:validateSheetsUrl`
   - Only URLs with hostnames `docs.google.com` or `docs.googleusercontent.com` are permitted. All external private IP addresses, localhost, and unauthorized domains are rejected with HTTP 403.
3. **Comprehensive HTTP Security Headers (`src/server/app.js`):**
   - `Content-Security-Policy`: Restricts scripts, styles, fonts, and connects to self and whitelisted LogRocket/Google domains.
   - `X-Frame-Options: DENY`: Prevents Clickjacking attacks.
   - `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
   - `Strict-Transport-Security: max-age=31536000`: Enforces HTTPS in production.
   - `Permissions-Policy: geolocation=(), microphone=(), camera=()`: Blocks unwanted browser APIs.
4. **Input Validation via Zod Schemas (`src/server/schemas/`):**
   - `loginSchema`, `registerSchema`, `dataUploadSchema`, `importUploadSchema`, `sheetsQuerySchema`.
   - Rejects malformed bodies with HTTP 400 before passing data to services.
5. **Rate Limiting (`src/server/middleware/rateLimit.js`):**
   - Authentication routes: 10 requests / 15 mins.
   - Data sync routes: 5 requests / min.
   - General API routes: 300 requests / min.
6. **Immutable Compliance Audit Logging (`src/server/utils/auditLogger.js`):**
   - Records all critical actions (`USER_LOGIN`, `USER_LOGOUT`, `DATA_UPLOAD`, `SYNC_TRIGGER`, `EXPORT`, `CONFIG_CHANGE`, `ALERT_ACKNOWLEDGED`) with user email, timestamp, action, and client IP address into PostgreSQL `audit_log`.

### 3.2 Security Observations & Recommendations

#### Confirmed Observations
- `DATABASE_URL` and `JWT_SECRET` must be set in production `.env`. If unset in production, `src/server/config/env.js` issues security warnings and generates random 32-byte ephemeral secrets to prevent default key vulnerabilities.
- Legacy login credentials (`ADMIN_USER`, `ADMIN_PASS`) are supported for fallback. In production, these should use strong passwords.

#### Needs Verification in Production Deployment
- Ensure production reverse proxies (e.g., Render, Nginx, Cloudflare) terminate SSL and forward `x-forwarded-proto: https` so Express security headers and secure cookie flags function correctly.
