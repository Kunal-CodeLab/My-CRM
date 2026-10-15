# Commercial Multi-Tenant SaaS CRM

Enterprise-grade B2B Customer Relationship Management (CRM) platform engineered with strict multi-tenant Row-Level Security (RLS), RFC 7807 problem details, Argon2id authentication with rotating token families, transactional outbox engine with monotonic worker fencing, and resilient React SPA frontend.

---

## 1. System Architecture & Tech Stack

```
                     ┌──────────────────────────────────────┐
                     │          React 18 + Vite SPA         │
                     │  (Zustand, TailwindCSS, Lucide Icons) │
                     └──────────────────┬───────────────────┘
                                        │ HTTP / JSON (RFC 7807)
                                        ▼
                     ┌──────────────────────────────────────┐
                     │        NestJS Fastify Gateway        │
                     │  (AuthGuards, PII Scrubber, RBAC)    │
                     └───────┬──────────────────────┬───────┘
                             │                      │
                  Interactive Transaction       Enqueue Jobs
                  (SET LOCAL tenant_id)             │
                             │                      ▼
                             ▼             ┌─────────────────┐
                 ┌───────────────────────┐ │ Redis 7 BullMQ  │
                 │ PostgreSQL 16 (RLS)   │ └────────┬────────┘
                 │ - Accounts & Contacts │          │
                 │ - Pipelines & Stages  │          ▼
                 │ - Deals & Activities  │ ┌─────────────────┐
                 │ - Append-Only Audit   │ │  Outbox Workers │
                 │ - Partitioned History │ └─────────────────┘
                 └───────────────────────┘
```

* **Core Backend:** NestJS 10, Fastify HTTP adapter, Prisma ORM, Zod validation schemas.
* **Database & Security:** PostgreSQL 16 with Row-Level Security (`app.current_tenant_id`), composite primary/foreign keys (`tenant_id, id`), Argon2id password hashing, and append-only cryptographic audit amendments.
* **Worker Queue:** Redis 7 with BullMQ and atomic monotonic worker fencing (`fence_token`).
* **Frontend:** React 18, Vite 6, Zustand state management, TailwindCSS, Lucide React, accessible confirmation dialogs, toast notification engine, and top-level error boundaries.
* **Monorepo Engine:** Turborepo with pnpm workspaces.

---

## 2. Quickstart & Local Development

### Prerequisites
* Node.js >= 20
* pnpm >= 9 (`corepack enable pnpm`)
* Docker & Docker Compose (optional for real PostgreSQL/Redis; automated in-memory tests run via PGlite)

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env` (already pre-configured for local development):
```bash
cp .env.example .env
```

### Step 3: Start Infrastructure (Docker)
```bash
docker compose up -d
```
* PostgreSQL: `localhost:5432` (`crm_dev`)
* Redis: `localhost:6379`
* MinIO Storage: `localhost:9000` (Console on `:9001`)

### Step 4: Seed Database
Populate deterministic demo organizations, users, pipelines, accounts, contacts, and deals:
```bash
pnpm db:seed
```

### Step 5: Start Development Servers
```bash
pnpm dev
```
* **Frontend SPA:** http://localhost:3000
* **API Gateway:** http://localhost:4000
* **Health Probes:** http://localhost:4000/healthz (Liveness) & `/readyz` (Readiness)

---

## 3. Demo Credentials (Seeded Dataset)

All seeded user accounts share the standard password: `Password123!`

| Organization | Email | Role | Access Scope |
| :--- | :--- | :--- | :--- |
| **Acme Corporation** | `admin@acme.com` | **Owner** | Full organization administrative access, billing quotas, team management |
| **Acme Corporation** | `sales@acme.com` | **Sales Rep (Member)** | Manage assigned accounts, contacts, deal stage transitions, activity notes |
| **Acme Corporation** | `auditor@acme.com` | **Read-Only** | Read-only domain inspection, audit logs, and compliance amendment verification |
| **Globex Corporation** | `admin@globex.com` | **Owner (Tenant B)** | Isolated tenant environment for cross-tenant boundary verification |

---

## 4. Quality Gates & Verification Commands

Run the comprehensive test matrix across both backend and frontend layers:

| Target | Command | Verification Scope |
| :--- | :--- | :--- |
| **Full Monorepo Build** | `pnpm build` | Compiles `@crm/shared-types`, `@crm/api`, and `@crm/web` via Turborepo |
| **Type Check & Lint** | `pnpm lint` | Strict TypeScript compiler validation with zero emit errors |
| **Full Monorepo Test** | `pnpm test` | Executes all 78 automated test cases across backend and frontend |
| **Phase 0 Security** | `pnpm test:phase0` | SQL injection defense, RLS fail-closed, audit partition denial |
| **Phase 1 Auth** | `pnpm test:phase1` | Argon2id verification, rotating JWT refresh token family theft recovery |
| **Phase 2 CRM Domain** | `pnpm test:phase2` | Accounts/Contacts/Deals CRUD, 20-thread concurrency, optimistic locks |
| **Phase 3 Outbox Engine**| `pnpm test:phase3` | Monotonic worker fencing, lease renewal, Ed25519 lawful audit erasure |
| **Phase 4 CSV Engine** | `pnpm test:phase4` | Formula neutralization (`=`, `@`, `+`, `-`), resumable chunked import |
| **Phase 5 Operations** | `pnpm test:phase5` | PITR disaster recovery drills, k6 load simulator SLO benchmark |
| **Team Administration**| `pnpm test:team` | Member invitations, role RBAC privilege updates, session revocation |
| **Database Seeder** | `pnpm test:seed` | Schema migration verification and deterministic multi-tenant data seeding |

---

## 5. Security & Compliance Safeguards

1. **Row-Level Security (RLS):** Every query executed against tenant domain tables sets transaction-scoped session variable `app.current_tenant_id`. Queries without an active tenant context fail closed with 0 rows returned.
2. **Optimistic Concurrency Control:** Deals maintain a monotonic integer `version` field. Concurrent stage updates with mismatched `expectedVersion` reject immediately with RFC 7807 `409 Conflict`.
3. **Lawful Erasure (GDPR / DPDPA):** Stored procedure `redact_entity_audit_history` requires a cryptographically signed Ed25519 authorization ticket. PII fields are redacted in-place, and a cryptographic digest is recorded to the append-only `audit_amendments` ledger.
4. **Formula Injection Neutralization:** All dynamic cell values exported to CSV are prefixed with an apostrophe (`'`) if they begin with dangerous spreadsheet formula triggers (`=`, `@`, `+`, `-`, `\t`, `\r`).
