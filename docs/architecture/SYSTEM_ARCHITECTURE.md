# System Architecture Specification — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Architecture Pattern:** Modular Monolith with Asynchronous Background Workers  

---

## 1. High-Level Architectural Topology

```
                  ┌────────────────────────────────────────┐
                  │       Vite + React 18+ SPA (Client)   │
                  │  (TanStack Query v5, Zustand, Tailwind)│
                  └───────────────────┬────────────────────┘
                                      │ HTTPS / REST (OpenAPI 3.0)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │      NestJS Modular Monolith API       │
                  │  ┌──────────┐ ┌──────────┐ ┌────────┐  │
                  │  │ Auth &   │ │ Tenant & │ │ Deals &│  │
                  │  │ Identity │ │ Org Mgt  │ │ Pipeline│ │
                  │  └────┬─────┘ └────┬─────┘ └───┬────┘  │
                  │  ┌────┴─────┐ ┌────┴─────┐ ┌───┴────┐  │
                  │  │ Contacts │ │ Activity │ │ Quotas │  │
                  │  │ & Accounts │ & Outbox │ │ & Export│ │
                  │  └──────────┘ └──────────┘ └────────┘  │
                  │    Core Unit of Work: TenantConnection │
                  └─────────────┬─────────────┬────────────┘
                                │             │
                    BullMQ Jobs │             │ SQL (Prisma / RLS)
                                ▼             ▼
                     ┌──────────────┐ ┌────────────────────┐
                     │ Redis 7 (AOF)│ │ PostgreSQL 16+     │
                     │ Queues & Rate│ │ Multi-Tenant RLS   │
                     │ Limits       │ │ Range Partitions   │
                     └──────────────┘ └────────────────────┘
```

---

## 2. Component Boundaries & Responsibilities

### 2.1 Frontend Single-Page Application (SPA)
* **Runtime:** React 18+ bundled via Vite with TypeScript.
* **State Segregation:**
  * **Server State:** Managed via TanStack Query v5. Automated cache invalidation, background refetching, and optimistic UI mutations with rollback.
  * **Client/Transient State:** Managed via Zustand (active slide-over drawers, command palette `Cmd+K` open/close states).
* **Cross-Tab Synchronization:**
  * Uses `BroadcastChannel('auth_sync')` for in-memory token distribution.
  * Uses `navigator.locks` for browser-origin single-flight refresh coordination. Zero Access Tokens stored in `localStorage`.

### 2.2 Backend Application (NestJS Modular Monolith)
* **Runtime:** Node.js 20+ LTS running NestJS with Fastify HTTP adapter.
* **Module Isolation Rules:**
  * `IdentityModule`: Users, password hashing (`argon2id`), refresh token families, invitation tokens.
  * `TenancyModule`: Organizations, memberships, session version checks.
  * `CrmCoreModule`: Accounts, Contacts, Pipelines, Deal Stages, Deals.
  * `ActivityModule`: Notes, Tasks, Reminders, and automated timeline generation.
  * `OutboxModule`: Transactional outbox persistence, BullMQ relay publisher.
  * `WorkerModule`: Asynchronous processing of exports, imports, and task reminders.
* **Communication Rules:**
  * Direct module-to-module dependencies are permitted strictly via exported Service interfaces.
  * Cross-domain side-effects (e.g., stage change $\rightarrow$ generate timeline activity $\rightarrow$ check quotas) are dispatched via transactional outbox events to guarantee consistency.

---

## 3. Request Lifecycle & Tenant Context Resolution

```
[Incoming HTTP Request] ──► [TLS Termination / Nginx Reverse Proxy]
                                     │
                                     ▼
                     [Authentication & Tenant Guard]
                     ├── 1. Extract Bearer JWT from Authorization Header
                     ├── 2. Verify signature & expiration
                     ├── 3. Extract { sub: userId, tid: tenantId, role }
                     ├── 4. Direct Database Membership Verification:
                     │      Query `memberships WHERE tenant_id = tid AND user_id = sub`
                     │      Assert status == 'active'
                     │
                     ▼
             [AsyncLocalStorage Request Scope Execution]
             ├── Store validated { currentUser, currentTenant }
             │
             ▼
             [TenantConnectionManager Unit of Work]
             ├── 1. Acquire pooled connection via prisma.$transaction()
             ├── 2. Execute SET LOCAL app.current_tenant_id = :tenantId
             ├── 3. Execute domain service queries via `tx` client
             └── 4. COMMIT/ROLLBACK releases connection; GUC auto-cleared
```

### 3.1 Dual Database Context Separation
To guarantee that un-scoped bootstrap queries cannot access CRM domain tables, the application defines two distinct database contexts:

1. **`SystemDbContext` (Bootstrap Context):**
   * Uses database role `crm_system_user`.
   * Possesses permissions **only** on global identity tables: `users`, `organizations`, `memberships`, `organization_invitations`, `refresh_tokens`, `refresh_token_families`.
   * Denied all access to `accounts`, `contacts`, `deals`, `activities`, and `tenant_quotas`.
2. **`TenantConnectionManager` (Domain Context):**
   * Uses database role `crm_app_user`.
   * Enforces `FORCE ROW LEVEL SECURITY` on all tenant-owned tables.
   * Domain repositories never receive the raw base `PrismaService`. All domain operations must execute inside `runInTenantScope(tenantId, async (tx) => ...)`.

---

## 4. Background Processing & Transactional Outbox Engine

### 4.1 At-Least-Once Delivery Architecture
To eliminate dual-write inconsistencies between PostgreSQL and Redis, all background tasks utilize the **Transactional Outbox Pattern**:

```
[Domain API Service]
        │
        ▼ (Single PostgreSQL Transaction)
┌────────────────────────────────────────────────────────┐
│ 1. Mutate Domain Record (e.g., Update Deal)           │
│ 2. Insert into `outbox_events`:                        │
│    { id, tenant_id, actor_id, event_type, payload,    │
│      idempotency_key, status: 'PENDING' }              │
│ COMMIT;                                                │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼ (Polls every 2 seconds or LISTEN/NOTIFY)
┌────────────────────────────────────────────────────────┐
│ Outbox Relay Service                                   │
│ Reads PENDING rows -> Enqueues into BullMQ             │
│ Sets `outbox_events.status = 'ENQUEUED'`               │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ BullMQ Worker Execution                                │
│ 1. Atomic Claim with Monotonic `fence_token`           │
│ 2. Recheck Actor Membership in PostgreSQL              │
│ 3. Execute Side Effect (Propagate Idempotency-Key)     │
│ 4. Conditional Complete: assert fence_token matches    │
└────────────────────────────────────────────────────────┘
```

### 4.2 Worker Failure & Fencing Protocol
* **Heartbeat Lease:** Workers claim events for 5 minutes (`status = 'PROCESSING'`). Workers renew the lease every 60 seconds by updating `claimed_at = NOW()`.
* **Fencing Tokens:** Every claim increments `fence_token = fence_token + 1`. If Worker 1 hangs and Worker 2 re-claims the event, Worker 1's late database update is rejected because its fencing token is obsolete.
* **Non-Idempotent External Providers:** If an external side effect lacks native idempotency support, crashes transition the event to `UNKNOWN_OUTCOME` for administrative reconciliation rather than automated redispatch.
