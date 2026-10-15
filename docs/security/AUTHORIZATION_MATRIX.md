# Authorization Matrix & RBAC Specification — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Model:** Multi-Tenant Role-Based Access Control (RBAC) with Record Ownership  

---

## 1. Functional Roles & Hierarchy

Every active user within an organization is assigned exactly one functional role within that organization's `memberships` table:
1. **`owner` (Tenant Owner):** Full administrative, commercial, and operational authority. Only role permitted to decommission the organization or update billing subscriptions.
2. **`admin` (Tenant Administrator):** Full operational authority. Can invite/revoke team members, manage pipeline stages, trigger exports, and reassign records.
3. **`member` (Sales Representative):** Operational rep. Can view all organization records, create new records, and update records assigned to them. Denied bulk export and administrative configuration.
4. **`read_only` (Auditor / Executive Viewer):** View-only access across all records and pipelines. Denied all write, update, delete, and export capabilities.

---

## 2. Complete Functional Authorization Matrix

| Functional Capability | Owner | Admin | Member (Record Owner) | Member (Non-Owner) | Read-Only |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Decommission Organization** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Subscription & Billing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Invite Team Members** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Revoke Member Access** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Configure Pipelines & Stages** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Bulk CSV Export (Contacts/Deals)**| ✅ | ✅ | ❌ (Denied) | ❌ (Denied) | ❌ (Denied) |
| **Bulk CSV Import (Contacts)** | ✅ | ✅ | ✅ | ✅ | ❌ (Denied) |
| **Create Account / Contact / Deal**| ✅ | ✅ | ✅ | ✅ | ❌ |
| **Update Assigned Deal / Contact** | ✅ | ✅ | ✅ (Own records) | ❌ (Denied) | ❌ |
| **Update Other / Unassigned Deal** | ✅ | ✅ | ❌ (Denied) | ❌ (Denied) | ❌ |
| **Delete Deal / Account / Contact**| ✅ | ✅ | ❌ (Denied) | ❌ (Denied) | ❌ |
| **Reassign Record Ownership** | ✅ | ✅ | ❌ (Denied) | ❌ (Denied) | ❌ |
| **Log Note / Activity / Task** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Pipelines, Deals & Contacts**| ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Record Ownership & Visibility Rules

### 3.1 Organization-Wide Visibility (Pilot Baseline)
* **Read Access:** All active members of an organization have visibility across standard CRM records (Accounts, Contacts, Deals, and Activities) within that organization.
* **Rationale:** Mid-market sales teams (3–25 reps) require transparent pipeline visibility to avoid account collisions and foster team accountability. Private-by-default silos are deferred to Phase 3.

### 3.2 Record Mutation Guard Protocol
When a `member` attempts to update or transition a deal (`PATCH /deals/:id` or `PATCH /deals/:id/stage`):
1. **Ownership Assertion:**
   ```typescript
   if (actor.role === 'member') {
     const deal = await tx.deal.findUnique({
       where: { id: targetDealId, tenantId: activeTenantId }
     });
     if (!deal || deal.ownerId !== actor.userId) {
       throw new ForbiddenException('You can only update records assigned to you.');
     }
   }
   ```
2. **Owner / Admin Bypass:** Users with `owner` or `admin` roles bypass the ownership check and may update any record in the organization.

---

## 4. Background Worker Authorization Rechecks

To prevent unauthorized data exfiltration when a user is downgraded while an asynchronous export is queued in BullMQ:
1. When the worker claims an export job, it reads `{ tenantId, actorId, action: 'EXPORT_CONTACTS' }`.
2. The worker re-checks PostgreSQL directly:
   ```sql
   SELECT role, status FROM public.memberships 
   WHERE tenant_id = :tenantId AND user_id = :actorId;
   ```
3. If `status != 'active'` or `role NOT IN ('owner', 'admin')`:
   * The job transitions to `status = 'FAILED'`.
   * Execution terminates immediately with zero S3 upload or file generation.
   * An audit security alert is appended: `UNAUTHORIZED_EXPORT_ATTEMPT_ABORTED`.
