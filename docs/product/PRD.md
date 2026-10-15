# Product Requirements Document (PRD) — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Product Classification:** Commercial Multi-Tenant B2B SaaS CRM  

---

## 1. Executive Summary & Market Positioning

### 1.1 Target Customer
* **Primary Segment:** B2B SMBs and Mid-Market agencies, consultancies, professional services, and software vendors (10–100 employees, 3–25 active sales representatives).
* **The Problem:** Existing enterprise CRMs (Salesforce, HubSpot Enterprise) suffer from configuration bloat, excessive per-seat pricing, and complex administrative overhead. Simpler tools (spreadsheets, Trello) lack deterministic pipeline stages, relational data integrity, audit trails, and strict tenant isolation.
* **The Solution:** A high-speed, keyboard-friendly, modular CRM providing visual deal velocity, relational account/contact intelligence, background activity tracking, and multi-tenant security without operational paralysis.

### 1.2 User Personas
1. **The Sales Representative (Operational Rep)**
   * *Jobs to be Done:* Log customer conversations, move deals across pipeline stages, review assigned follow-up tasks, search across accounts with zero latency.
   * *Pain Points:* Clunky multi-step forms, slow modal popups, losing draft notes when switching views.
2. **The Sales Director / Business Owner (Decision Maker)**
   * *Jobs to be Done:* Track overall pipeline valuation, monitor stage-by-stage conversion velocity, enforce mandatory deal loss reasons, export clean customer lists.
   * *Pain Points:* Reps failing to update deals due to bad UX, lack of accountability, and fear of data leaks.
3. **The Tenant Administrator (Operations / IT)**
   * *Jobs to be Done:* Provision team members, assign operational roles, configure custom pipeline stages, manage data exports.
   * *Pain Points:* Accidental global setting mutations, complex permission matrices, and lack of audit logs.

### 1.3 Measurable Success Criteria & Target SLOs
* **Application Performance (Target SLOs):**
  * P95 API Response Time: $\le 200\text{ms}$ under 50 concurrent virtual users.
  * P99 API Response Time: $\le 500\text{ms}$.
  * Client Initial Paint: $< 1.2\text{s}$ over broadband connection.
  * Kanban Drag-to-Persist: $< 120\text{ms}$ visual snap (optimistic update with server rollback).
* **Isolation & Integrity:**
  * Zero cross-tenant data leakage events across all test suites and runtime operations.
  * 100% of tenant-owned table queries run under transaction-scoped PostgreSQL Row-Level Security (`app.current_tenant_id`).

---

## 2. Product Scope & Functional Modules

### 2.1 First-Release Scope (Phase 1: Pilot Core)
1. **Multi-Tenancy & Identity:**
   * Organization provisioning and team member invitation via secure token links.
   * Multi-organization membership switching under a single user identity.
   * Session authentication via short-lived JWT access tokens and rotating refresh tokens with 30-second bounded recovery.
2. **Account Management (Companies):**
   * Company profiles, domain tracking, annual revenue, industry, and assigned owner.
   * Direct relational link to contacts and deal histories.
3. **Contact Management:**
   * Individual profiles (first name, last name, email, phone, job title).
   * Association with parent Account and assigned rep.
4. **Pipeline & Deal Engine:**
   * Visual Kanban board with stage columns and tabular list view.
   * Customizable pipeline stages with win/loss flags and probability percentages.
   * Monetary deal value, currency code, expected close date, and win/loss reason capture.
5. **Activity & Engagement Stream:**
   * Notes (rich Markdown text), follow-up tasks with deadlines, and automated audit history (stage changes, record updates).
6. **Import & Export Engine:**
   * Chunked, resumable CSV contact import with deduplication modes (`SKIP`, `UPDATE`, `CREATE_ALL`).
   * Asynchronous CSV exports with spreadsheet formula injection defense (`'` prefixing).
7. **Quota & Entitlement Guard:**
   * Plan-level limits on active deals and seat counts, enforced via Level-1 database row locks.

### 2.2 Explicit Exclusions (Deferred to Post-Pilot Releases)
* Direct IMAP/SMTP two-way mailbox synchronization.
* VoIP browser dialing and SMS mass messaging.
* Dynamic user-defined custom entity builders (runtime DDL).
* Native Stripe billing checkout (mock entitlement engine used for pilot).
* Multi-currency real-time conversion rates (single tenant-default currency in pilot).

---

## 3. Core Business Rules

1. **Currency Handling:**
   * Each organization selects a single tenant-default ISO 4217 currency code upon creation (e.g., `USD`, `INR`, `EUR`).
   * All deal values are stored as `NUMERIC(15, 2)` in the tenant-default currency.
2. **Time Zones & Timestamps:**
   * All database timestamps are strictly stored in UTC (`TIMESTAMPTZ`).
   * User profiles store an IANA Timezone identifier (e.g., `Asia/Kolkata`, `America/New_York`) for localized UI rendering.
3. **Stage Transitions & Validation Invariants:**
   * Transition to `Closed-Won` requires `value > 0` and `expected_close_date IS NOT NULL`.
   * Transition to `Closed-Lost` requires `lost_reason` text.
   * Terminal stages lock active pipeline deal counters, releasing quota capacity for new opportunities.
4. **Optimistic Locking:**
   * Deals carry an integer `version` column. Client updates must supply `expectedVersion`. Mismatched versions return HTTP `409 Conflict`.
5. **Deduplication:**
   * Contact deduplication matches on `(tenant_id, email)`. Account deduplication matches on `(tenant_id, domain)`.
