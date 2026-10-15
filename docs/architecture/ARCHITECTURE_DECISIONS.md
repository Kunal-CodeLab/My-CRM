# Architecture Decision Records (ADRs) — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  

---

## Index of Architectural Decisions

* [AD01: Defense-in-Depth RLS Threat Model & Disaggregated Test Suites](#ad01-defense-in-depth-rls-threat-model--disaggregated-test-suites)
* [AD02: In-Memory Cross-Tab Token Synchronization](#ad02-in-memory-cross-tab-token-synchronization)
* [AD03: Refresh-Token Lineage Tracking & Bounded Retry Convergence](#ad03-refresh-token-lineage-tracking--bounded-retry-convergence)
* [AD04: Invariant Global Lock Hierarchy with Unconditional Quota Locks](#ad04-invariant-global-lock-hierarchy-with-unconditional-quota-locks)
* [AD05: Privileged Role-Isolated Audit Erasure & Cryptographic Ledger](#ad05-privileged-role-isolated-audit-erasure--cryptographic-ledger)
* [AD06: Transactional Outbox Pattern with Worker Fencing](#ad06-transactional-outbox-pattern-with-worker-fencing)
* [AD07: Fail-Closed Tenant-Aware Partition Archiving & Legal Holds](#ad07-fail-closed-tenant-aware-partition-archiving--legal-holds)
* [AD08: Technology Stack Selection (NestJS, React/Vite, Postgres, Redis)](#ad08-technology-stack-selection)

---

### AD01: Defense-in-Depth RLS Threat Model & Disaggregated Test Suites
* **Context:** The CRM relies on PostgreSQL Row-Level Security (RLS) driven by a session variable (`SET LOCAL app.current_tenant_id`).
* **Decision:** Treat the custom GUC as a defense-in-depth barrier against application programming bugs, **not** an unforgeable boundary against arbitrary SQL injection. Parameterized queries prevent user input from being interpreted as executable SQL when implemented correctly; they do not make the custom GUC itself unforgeable.
* **Security & Performance Implications:** Disaggregates testing into three distinct suites: SQL-injection prevention, RLS tenant-isolation, and membership-authorization. Zero performance penalty beyond the standard `< 1ms` transaction setup.
* **Alternatives Considered:** Application-only filtering (`where: { tenantId }`). Rejected due to catastrophic risk if an engineer omits a filter.

---

### AD02: In-Memory Cross-Tab Token Synchronization
* **Context:** Storing JWT Access Tokens in `localStorage` or `sessionStorage` exposes credentials to XSS extraction.
* **Decision:** Keep Access Tokens strictly in JavaScript heap memory inside each tab. Coordinate cross-tab token refreshes using `BroadcastChannel('auth_sync')` and the `navigator.locks` API.
* **Security & Performance Implications:** XSS attackers cannot read tokens from disk or web storage. Tabs coordinate refresh calls without dispatching duplicate HTTP requests.
* **Alternatives Considered:** Storing tokens in `localStorage`. Rejected due to known XSS vulnerability.

---

### AD03: Refresh-Token Lineage Tracking & Bounded Retry Convergence
* **Context:** Successive rotations ($R_1 \rightarrow R_2 \rightarrow R_3$) caused by delayed browser tabs or lost network responses risk locking out legitimate users if older tokens are aggressively revoked.
* **Decision:** Implement **bounded retry convergence with an explicit residual replay risk**. The server tracks lineage and maintains an encrypted active token envelope for the family. Presenting an ancestor token within 30 seconds returns the currently active token pair, converging delayed tabs. Presenting an ancestor token after 30 seconds returns `401 ERR_STALE_TOKEN` without revoking the family. Family revocation is reserved for confirmed security violations (account revocation, invalid family binding).
* **Security & Performance Implications:** Acknowledges the explicit residual risk that an adversary possessing an intercepted token within the 30s window can obtain the active session. Mitigated by `HttpOnly`, `SameSite=Strict`, `Path`-scoped cookies, and exact Origin whitelisting.
* **Alternatives Considered:** Immediate family revocation on any delayed token submission. Rejected due to severe false-positive user lockouts.

---

### AD04: Invariant Global Lock Hierarchy with Unconditional Quota Locks
* **Context:** Concurrent stage movements, quota limit checks, and membership updates cause PostgreSQL deadlocks (`40P01`). Deciding whether to lock quotas based on pre-read state introduces race conditions.
* **Decision:** Enforce an invariant 8-level lock hierarchy:
  $$\text{Quotas (Level 1)} \rightarrow \text{Memberships (Level 2)} \rightarrow \text{Pipelines (Level 3)} \rightarrow \text{Stages (Level 4)} \rightarrow \text{Accounts (Level 5)} \rightarrow \text{Contacts (Level 6)} \rightarrow \text{Deals (Level 7)} \rightarrow \text{Activities (Level 8)}$$
  Every deal stage transition acquires the Level-1 quota lock unconditionally `FOR UPDATE`, locks Level-2 membership, locks Level-4 stages, locks Level-7 deals, and re-validates all invariants before mutation.
* **Security & Performance Implications:** Eliminates lock inversion deadlocks. Serializes quota limits and membership revocations safely.

---

### AD05: Privileged Role-Isolated Audit Erasure & Cryptographic Ledger
* **Context:** Privacy regulations mandate redacting personal data, but in-place updates break hash chains and violate append-only trigger contracts.
* **Decision:** Implement a dual-verification cryptographic model. Historical Merkle checkpoints authenticate historical records. A hardened `SECURITY DEFINER` stored procedure (`redact_entity_audit_history`), locked strictly to `crm_maintenance` and verified via asymmetric Ed25519 authorization tickets, recursively redacts structured JSONB PII and writes to an append-only `audit_amendments` ledger.
* **Security & Performance Implications:** Eliminates GUC-based bypasses. Mathematically authenticates post-erasure audit states without claiming mutated rows still match their original entry hashes.

---

### AD06: Transactional Outbox Pattern with Worker Fencing
* **Context:** Direct enqueueing to BullMQ inside HTTP handlers causes dual-write inconsistencies during Redis restarts or network timeouts.
* **Decision:** Write background events to an `outbox_events` table within the same PostgreSQL transaction as domain mutations. Workers claim events using monotonic fencing tokens (`fence_token`). Stale worker database updates are rejected; external duplicate side effects are mitigated via provider idempotency keys or transitioned to `UNKNOWN_OUTCOME`.
* **Security & Performance Implications:** Guarantees at-least-once delivery. Prevents split-brain database updates from expired worker leases.

---

### AD07: Fail-Closed Tenant-Aware Partition Archiving & Legal Holds
* **Context:** Shared monthly audit partitions cannot be dropped safely if a single tenant is under a legal hold. Late writes arriving during purge could be lost.
* **Decision:** Implement a **two-phase detach-before-extract protocol**. Detach the partition DDL first to block all late writes. Extract held tenant slices to versioned S3 archives (`.jsonl.zst`), verify checksums and test restoration in staging. If any verification fails, the partition is re-attached and the drop aborts (fails closed).
* **Security & Performance Implications:** Prevents data loss for legally held tenants while allowing scheduled purge for normal tenants across the 91–121 day retention window.

---

### AD08: Technology Stack Selection
* **Frontend:** React 18+ with Vite, TypeScript, Tailwind CSS, TanStack Query v5, Zustand.
* **Backend:** Node.js 20+ LTS with NestJS (Fastify), TypeScript, class-validator.
* **Database:** PostgreSQL 16+ with native UUID v7, Row-Level Security, and Range Partitioning.
* **ORM:** Prisma 5+ with custom `TenantConnectionManager` interactive transaction unit-of-work.
* **Queue / Cache:** Redis 7 with AOF persistence (`noeviction` policy) and BullMQ.
* **Storage:** S3-compatible object storage (Cloudflare R2 / AWS S3) via presigned URLs.
