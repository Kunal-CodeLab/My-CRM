# Testing Strategy & Quality Assurance Gates — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Test Frameworks:** Vitest, Testcontainers (PostgreSQL 16 + Redis 7), Playwright, k6  

---

## 1. Test Pyramid & Execution Architecture

```
                       ▲
                      / \
                     /   \
                    / E2E \       Playwright: Critical User Journeys
                   /───────\      (Auth, Org Switch, Drag Deal, Export)
                  /  Integ  \
                 /  Isolation\    Testcontainers (Real PostgreSQL 16 + Redis 7)
                /─────────────\   Tenant Isolation, Lock Ordering & RBAC
               /     Unit      \
              /─────────────────\ Vitest: DTO Validation, Quota Calculations,
             /                   \ Audit Redaction, Token Lineage
```

---

## 2. Disaggregated Test Catalog & Planned Acceptance Criteria

All tests are documented as **Planned Verification Criteria** to be implemented and passed during their respective development phases.

### 2.1 Suite 1: SQL-Injection Prevention (Planned)
* **Objective:** Ensure parameterized queries prevent arbitrary SQL execution from reaching the PostgreSQL parser.
* **Test Command:** `pnpm test:sqli`
* **Planned Criterion:** Inject raw SQL payloads (e.g., `'; SET app.current_tenant_id = '...'; --`) across all search, filter, and text fields. Assert 100% of payloads are treated strictly as string literals; zero SQL syntax errors or GUC manipulations occur.

### 2.2 Suite 2: RLS Tenant-Isolation & Negative Cross-Tenant Leaks (Planned)
* **Objective:** Verify PostgreSQL RLS prevents data leakage across tenants under valid SQL execution.
* **Test Command:** `pnpm test:isolation`
* **Planned Criterion:** Seed Tenant A with Deal 1 and Tenant B with Deal 2. Authenticate as Tenant A rep. Issue `GET /deals/:deal2Id` and `PATCH /deals/:deal2Id`. Assert returns 404/403. Execute `SELECT * FROM deals` omitting tenant filter; assert only Tenant A deals are returned.

### 2.3 Suite 3: Membership-Authorization & Pre-GUC Verification (Planned)
* **Objective:** Verify application guards block requests before database connection checkout or GUC assignment.
* **Test Command:** `pnpm test:auth-guards`
* **Planned Criterion:** Authenticate User 1 (member of Tenant A). Issue API request with header/JWT specifying Tenant B. Assert request is rejected with `403 Forbidden` prior to `TenantConnectionManager` invocation.

### 2.4 Suite 4: Direct Child-Partition Access Denial (Planned)
* **Objective:** Verify that `crm_app_user` cannot query partition child tables directly.
* **Test Command:** `pnpm test:child-partitions`
* **Planned Criterion:** Connect as `crm_app_user`. Execute `SELECT * FROM public.audit_logs_y2026m10;`. Assert PostgreSQL throws error `42501: permission denied for table audit_logs_y2026m10`.

### 2.5 Suite 5: Refresh-Token Concurrency & Lineage (Planned)
* **Objective:** Verify token rotation, bounded recovery convergence, and replay detection.
* **Test Command:** `pnpm test:refresh-lineage`
* **Planned Criteria:**
  1. *Client Single-Flight:* 5 parallel browser tabs refresh simultaneously; assert exactly 1 HTTP request is dispatched; all tabs receive the new token in memory.
  2. *Server Convergence:* 5 parallel HTTP requests with $R_1$ hit `/auth/refresh`; assert exactly 1 rotation occurs; 4 receive the active token pair; family remains active.
  3. *Successive Rotations:* Rotate $R_1 \rightarrow R_2 \rightarrow R_3$; submit $R_1$ at $t=10\text{s}$; assert client converges to active pair $\{ A_3, R_3 \}$.
  4. *Expired Replay:* Submit $R_1$ at $t=35\text{s}$; assert request rejected with `401 ERR_STALE_TOKEN`; active family remains intact.

### 2.6 Suite 6: Concurrency & Lock-Order Stress Testing (Planned)
* **Objective:** Verify the 8-level lock hierarchy eliminates PostgreSQL deadlocks.
* **Test Command:** `pnpm test:concurrency-locks`
* **Planned Criterion:** Execute 20 concurrent threads randomly creating, moving, and soft-deleting deals across stages and updating memberships in the same tenant. Assert zero deadlock exceptions (`40P01`).

---

## 3. Load Testing & Performance Benchmark (k6)

### 3.1 Workload Profile
* **Concurrency:** 50 virtual users executing simultaneous operations over 30 minutes.
* **Database Scale:** Seeded with 100 organizations, 1,000 users, 100,000 contacts, 50,000 deals, 250,000 activities.
* **Request Mix:** 70% reads (`GET /deals`, `GET /contacts`), 20% updates (`PATCH /deals/:id/stage`), 10% writes (`POST /deals`, `POST /activities`).

### 3.2 Target Success Gates (Proposed SLOs)
* P95 API Latency $\le 200\text{ms}$.
* P99 API Latency $\le 500\text{ms}$.
* Error Rate $< 0.1\%$ across all HTTP requests.
* Test Command: `pnpm test:load`
