# Deployment, Operations & Disaster Recovery — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Infrastructure Baseline:** Single Primary Cloud Region (e.g., `ap-south-1` Mumbai or `eu-central-1` Frankfurt)  

---

## 1. Production Topology & Connection Budgets

### 1.1 Compute & Data Service Topology
* **API Nodes:** 1–2 Container instances (Node.js/NestJS, 2 vCPU, 4GB RAM each).
* **Worker Node:** 1 Dedicated container instance (BullMQ workers, 1 vCPU, 2GB RAM).
* **Database:** Managed PostgreSQL 16 (2 vCPU, 4GB RAM, NVMe storage with automated PITR).
* **Queue / Cache:** Managed Redis 7 (1GB RAM, High Availability, AOF persistence enabled, `noeviction` policy).
* **Object Storage:** Cloudflare R2 / AWS S3 (S3-compatible API, private buckets for exports and backups).

### 1.2 PostgreSQL Connection Pool Budget
* **Database Max Connections:** **100**
* **Explicit Allocation:**
  * API Node 1 (Prisma Client Pool): Max 20 connections
  * API Node 2 (Prisma Client Pool): Max 20 connections
  * Background Worker Pool: Max 10 connections
  * CI/CD Migrations (`crm_migrator`): Max 5 connections (ephemeral)
  * Administrative / Maintenance Buffer: Max 5 connections
  * Unallocated Safety Margin: **40 connections**
* **PgBouncer Policy:** Deferred during pilot scale ($< 3$ API instances). Direct connection pooling in Prisma is sufficient and avoids prepared-statement incompatibilities.

---

## 2. Backup Architecture, Retention & Disaster Recovery

### 2.1 Continuous Archiving & PITR
* **Mechanism:** Continuous PostgreSQL Write-Ahead Log (WAL) archiving to S3 combined with daily base snapshots.
* **Target RPO (Recovery Point Objective):** $\le 15\text{ minutes}$ (WAL archive flush interval).
* **Target RTO (Recovery Time Objective):** $\le 90\text{ minutes}$ (time to provision an ephemeral database node and replay logs).

### 2.2 Monthly Automated Restoration Drill
To ensure backups are not merely generated but proven recoverable:
1. An automated CI/CD pipeline triggers on the 1st of every month.
2. Spins up an ephemeral PostgreSQL container in an isolated staging VPC.
3. Downloads the latest base backup and replays WAL archives up to a target timestamp from the prior day.
4. Executes relational integrity queries and counts records across `accounts`, `deals`, and `contacts`.
5. Emits an audit report to the developer; tears down the ephemeral container.

---

## 3. Database Migration & Forward-Recovery Strategy

### 3.1 Expand and Contract Migration Pattern
To guarantee zero-downtime schema evolution:
1. **Phase 1 (Expand):** Add new columns as nullable. Deploy application code that reads from old columns and writes to both old and new columns.
2. **Phase 2 (Backfill):** Run an asynchronous BullMQ worker backfilling existing rows.
3. **Phase 3 (Contract):** Deploy application code reading strictly from the new column. Drop old column in a subsequent release.

### 3.2 Forward-Recovery Policy
* Destructive rollbacks on production data are fundamentally unsafe.
* If a migration introduces an unexpected defect, the system executes a forward-fix migration (`forward-fix.sql`) rather than attempting a backwards rollback that risks data corruption.

---

## 4. Observability & Monitoring Baseline

* **Error Tracing:** Sentry integrated into both NestJS API and React SPA. Captures unhandled exceptions with sanitized request metadata (PII stripped).
* **Health Check Endpoint (`GET /healthz`):**
  * Executes lightweight `SELECT 1` on PostgreSQL and `PING` on Redis.
  * Monitored by an external uptime service (BetterStack / Uptime Kuma) every 60 seconds.
* **Structured Logging:** Pino logger outputting structured JSON to stdout, with automated regex filters redacting authorization headers, cookies, passwords, and tokens.

---

## 5. Solo-Developer Monthly Operational Cost Estimate

| Component | Target Spec (Pilot) | Workload Assumption | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- |
| **API & Worker Compute** | Hetzner Cloud / Fly.io / Render | 2x Shared vCPU, 4GB RAM | \$20 – \$35 |
| **Managed PostgreSQL** | Managed 16+ (Hetzner / Neon / RDS)| 2 vCPU, 4GB RAM, NVMe | \$30 – \$50 |
| **Managed Redis** | Managed 7 (Upstash / Aiven) | 1GB RAM, AOF persistence | \$15 – \$25 |
| **Object Storage** | Cloudflare R2 | S3 API, zero egress fees | \$1 – \$5 |
| **Transactional Email** | Resend / Postmark | 10,000 emails/month | \$10 – \$20 |
| **Total Estimated Run-Rate**| | | **\$76 – \$135 / month** |
*(All specs and costs are provisional estimates subject to actual pilot cloud provider pricing).*
