# Threat Model & Security Architecture — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Methodology:** STRIDE Threat Classification & Defense-in-Depth Analysis  

---

## 1. STRIDE Threat Analysis Matrix

| Threat Category | Potential Attack Vector | Applied Engineering Mitigation | Verification Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker steals expired or rotated refresh token and impersonates user. | Short-lived JWTs (15m), `HttpOnly SameSite=Strict` cookies, rotation lineage tracking, and 30s recovery envelope. | Automated Playwright test verifying replayed token triggers family revocation. |
| **Tampering** | User alters URL parameters to update another tenant's deal (`PATCH /deals/foreign-id`). | Composite foreign keys `(tenant_id, id)` and PostgreSQL `FORCE ROW LEVEL SECURITY`. RLS returns 0 rows. | Negative isolation test verifying 404/403 returned on foreign UUID manipulation. |
| **Repudiation** | Malicious rep deletes high-value records and denies action. | Append-only partitioned `audit_logs` table with cryptographic hash chaining and data-minimized tombstones. | Automated trigger test asserting `UPDATE` or `DELETE` on active audit partitions raises exception. |
| **Information Disclosure** | SQL Injection leaks foreign tenant records or manipulates custom GUC. | 100% Parameterized queries via Prisma; custom GUC is transaction-scoped; `crm_app_user` lacks DDL privileges. | SQL Injection test suite verifying raw string payloads fail safely without GUC alteration. |
| **Denial of Service** | Malicious tenant issues runaway queries or concurrent exports to starve resources. | Redis token bucket rate limiting (600 req/min/tenant), cursor pagination capped at `limit=100`, BullMQ export queuing. | k6 load test asserting rate limiter returns 429 when tenant request limits are exceeded. |
| **Elevation of Privilege** | Sales Rep submits payload updating their role to `owner` or creating excessive deals. | Strict DTO validation (`forbidNonWhitelisted: true`), NestJS RBAC guards, and Level-1 transactional quota row locks. | RBAC negative test asserting non-admin cannot alter membership roles or bypass quota barriers. |

---

## 2. RLS Security Model & Custom GUC Threat Boundaries

### 2.1 Threat Boundary Analysis
* **Mechanism:** Tenant isolation relies on `SET LOCAL app.current_tenant_id = :tenantId`.
* **The Vulnerability:** Setting a custom configuration parameter is **not an unforgeable security boundary**. If an attacker achieves arbitrary SQL execution under `crm_app_user`, they can execute `SET app.current_tenant_id = 'victim-uuid'` to bypass the RLS filter.
* **The Layered Defense:**
  1. Parameterized queries eliminate SQL injection vulnerabilities.
  2. The application verifies user membership in the tenant *before* acquiring a pooled connection.
  3. `crm_app_user` is stripped of `SUPERUSER`, `BYPASSRLS`, and DDL privileges.
  4. RLS provides mathematical defense-in-depth against accidental application programming bugs (missing WHERE clauses).

---

## 3. Rate Limiting Architecture

Implemented via Redis sliding-window token bucket:
* **Global IP Tier:** 100 requests per minute per IP address (mitigates automated scanners and brute-force).
* **Tenant Tier:** 600 requests per minute per active organization (protects against noisy-neighbor starvation).
* **Sensitive Endpoints:**
  * `POST /api/v1/auth/login`: 5 attempts per 15 minutes per IP/Email.
  * `POST /api/v1/auth/refresh`: 60 requests per minute per IP.
  * `POST /api/v1/exports/*`: 2 requests per hour per Tenant.
  * `POST /api/v1/imports/*`: 5 uploads per hour per Tenant.

---

## 4. Credential Security & Account Recovery

### 4.1 Password Hashing Baseline
* **Algorithm:** `argon2id` (RFC 9106).
* **Parameters:** Memory cost 64MB (`m=65536`), time cost 3 iterations (`t=3`), parallelism 1 thread (`p=1`).
* **Storage:** Stored in `users.password_hash` with random 128-bit salt.

### 4.2 Account Recovery Protocol
* High-entropy 256-bit cryptographic token generated via `crypto.randomBytes(32)`.
* Storage: SHA-256 hash stored in `password_resets` table with `expires_at = NOW() + INTERVAL '15 minutes'`.
* **Security Invariant:** Upon successful password reset:
  1. All refresh token families for that user are immediately marked `is_revoked = TRUE`.
  2. All active memberships increment `session_version = session_version + 1`.
  3. All existing sessions are terminated across all devices on their very next request.

---

## 5. Secrets Management & Environment Hygiene
* **Zero Secrets in Repository:** Production secrets (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `STORAGE_SECRET`) are never committed to git or built into Docker images.
* **Runtime Injection:** Injected strictly at container startup via a secure secret manager (e.g., Infisical, Doppler, or AWS Secrets Manager).
* **Log Redaction Filter:** Pino logger configured with an automatic regex filter stripping `Authorization`, `cookie`, `password`, `token`, and financial patterns before writing to stdout.
