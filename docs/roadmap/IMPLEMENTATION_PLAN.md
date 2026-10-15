# Phased Implementation Plan & Quality Gates — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Execution Model:** Phased Milestone Implementation with Mandatory Quality Gates  

---

## 1. Phased Implementation Roadmap

```
Phase 0: Database Core & Schema Foundation
   │
   ▼ [Gate 0: Test Suites 1, 2, & 4 Pass]
Phase 1: Identity, Auth & Cross-Tab Concurrency
   │
   ▼ [Gate 1: Test Suite 3 & Suite 5 Pass]
Phase 2: CRM Core Relational Domain
   │
   ▼ [Gate 2: Lock Hierarchy & Concurrency Tests Pass]
Phase 3: Outbox Engine & Reliable Background Workers
   │
   ▼ [Gate 3: Outbox Fencing & Redaction Procedures Pass]
Phase 4: CSV Engine & Frontend Assembly
   │
   ▼ [Gate 4: Chunked Import & UI Optimistic Tests Pass]
Phase 5: Operational Hardening & Pilot Launch
   │
   ▼ [Gate 5: k6 Load SLO & Backup Restore Drills Pass]
Production Pilot Deployment
```

---

## 2. Milestone Details & Verification Gates

### Phase 0: Database Core & Schema Foundation
* **Scope:**
  * Docker Compose environment (PostgreSQL 16, Redis 7, MinIO).
  * PostgreSQL 16 schema with composite keys, matching UNIQUE constraints, and range-partitioned `audit_logs`.
  * Database roles (`crm_system_user`, `crm_app_user`, `crm_maintenance`, `crm_migrator`) and schema privilege hardening.
  * Prisma schema and `TenantConnectionManager` interactive transaction unit-of-work.
* **Verification Command:** `pnpm test:phase0`
* **Quality Gate:** Test Suites 1 (SQLi), 2 (RLS Isolation), and 4 (Direct Child Partition Denial) must pass.

### Phase 1: Identity, Auth & Cross-Tab Concurrency
* **Scope:**
  * Argon2id password hashing and user registration.
  * Two-phase organization provisioning service.
  * JWT access tokens + rotating refresh cookies with lineage tracking and 30s recovery convergence.
  * In-memory `BroadcastChannel` and `navigator.locks` client coordination.
  * Direct database membership verification guard.
* **Verification Command:** `pnpm test:phase1`
* **Quality Gate:** Test Suite 3 (Auth Guards) and Suite 5 (Refresh Lineage Tests 2.1–2.4) must pass.

### Phase 2: CRM Core Relational Domain
* **Scope:**
  * Accounts, Contacts, Pipelines, Deal Stages, and Deals DTOs, Services, and Controllers.
  * Optimistic version locking on deal updates.
  * Invariant 8-level lock hierarchy with unconditional Level-1 quota locking on deal stage transitions.
* **Verification Command:** `pnpm test:phase2`
* **Quality Gate:** Test Suite 6 (20-thread concurrency deadlock stress test) must complete with 0 deadlock exceptions (`40P01`).

### Phase 3: Outbox Engine & Reliable Background Workers
* **Scope:**
  * Transactional outbox table + BullMQ relay worker with atomic claiming and monotonic `fence_token`.
  * Worker heartbeat lease renewal and `UNKNOWN_OUTCOME` dead-letter handling.
  * Hardened audit lawful erasure stored procedure (`redact_entity_audit_history`) with Ed25519 signature tickets and `audit_amendments` ledger.
  * Fail-closed legal hold slice extraction and partition purge script.
* **Verification Command:** `pnpm test:phase3`
* **Quality Gate:** Outbox worker fencing recovery tests and cryptographic amendment verification tests must pass.

### Phase 4: CSV Engine & Frontend Assembly
* **Scope:**
  * Two-phase immutable snapshot export engine with chunked persistence and formula neutralization.
  * Chunked resumable CSV contact import with deduplication modes.
  * React 18+ SPA assembly: Collapsible sidebar, Command Palette (`Cmd+K`), Slide-over drawer, and Kanban board with optimistic drag-and-drop.
* **Verification Command:** `pnpm test:phase4`
* **Quality Gate:** Playwright E2E tests for import crash resumption, Kanban drag-and-drop rollback, and formula neutralization must pass.

### Phase 5: Operational Hardening & Pilot Launch
* **Scope:**
  * k6 load testing against staging environment (50 virtual users).
  * Automated PITR backup restoration drill validation.
  * Production deployment on single-region Linux VPS with Sentry error monitoring and uptime health checks.
* **Verification Command:** `pnpm test:phase5`
* **Quality Gate:** P95 latency $\le 200\text{ms}$ verified under load; 100% test pass rate; zero critical CVEs in `pnpm audit`.
