import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { CsvService } from '../../src/csv/csv.service';
import { createTestDatabase } from '../phase0/pglite-runner';
import { TenantContext } from '@crm/shared-types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Phase 4: CSV Engine, Formula Neutralization & Resumable Import Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let csvService: CsvService;

  let tenantAId: string;
  let tenantBId: string;
  let adminAId: string;
  let memberAId: string;
  let readOnlyAId: string;
  let adminBId: string;

  let adminAContext: TenantContext;
  let memberAContext: TenantContext;
  let readOnlyAContext: TenantContext;
  let adminBContext: TenantContext;

  beforeEach(async () => {
    db = await createTestDatabase();
    csvService = new CsvService(db as any);

    // Seed Organizations
    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Acme Corp', 'acme-corp'),
              ($2, 'Globex Inc', 'globex-inc')`,
      [tenantAId, tenantBId],
    );

    // Seed Users
    adminAId = crypto.randomUUID();
    memberAId = crypto.randomUUID();
    readOnlyAId = crypto.randomUUID();
    adminBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.users (id, email, password_hash, first_name, last_name)
       VALUES ($1, 'admin@acme.com', 'hash', 'Alice', 'Admin'),
              ($2, 'rep@acme.com', 'hash', 'Bob', 'Rep'),
              ($3, 'auditor@acme.com', 'hash', 'Audrey', 'Auditor'),
              ($4, 'admin@globex.com', 'hash', 'George', 'Admin')`,
      [adminAId, memberAId, readOnlyAId, adminBId],
    );

    // Seed Memberships
    await db.query(
      `INSERT INTO public.memberships (id, tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'admin', 'active'),
              ($4, $5, $6, 'member', 'active'),
              ($7, $8, $9, 'read_only', 'active'),
              ($10, $11, $12, 'admin', 'active')`,
      [
        crypto.randomUUID(), tenantAId, adminAId,
        crypto.randomUUID(), tenantAId, memberAId,
        crypto.randomUUID(), tenantAId, readOnlyAId,
        crypto.randomUUID(), tenantBId, adminBId,
      ],
    );

    adminAContext = {
      userId: adminAId,
      email: 'admin@acme.com',
      tenantId: tenantAId,
      role: 'admin',
      permissions: ['*'],
    };

    memberAContext = {
      userId: memberAId,
      email: 'rep@acme.com',
      tenantId: tenantAId,
      role: 'member',
      permissions: ['read', 'write'],
    };

    readOnlyAContext = {
      userId: readOnlyAId,
      email: 'auditor@acme.com',
      tenantId: tenantAId,
      role: 'read_only',
      permissions: ['read'],
    };

    adminBContext = {
      userId: adminBId,
      email: 'admin@globex.com',
      tenantId: tenantBId,
      role: 'admin',
      permissions: ['*'],
    };
  });

  // =========================================================================
  // TEST 1: FORMULA NEUTRALIZATION (SPREADSHEET INJECTION DEFENSE)
  // =========================================================================
  it('1. Formula Neutralization: Prefixes injection payloads with apostrophe to neutralize spreadsheet execution', () => {
    // Dangerous prefixes: =, +, -, @, \t, \r
    expect(csvService.neutralizeFormula('=1+1')).toBe("'=1+1");
    expect(csvService.neutralizeFormula('+123456')).toBe("'+123456");
    expect(csvService.neutralizeFormula('-5+cmd|')).toBe("'-5+cmd|");
    expect(csvService.neutralizeFormula('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(csvService.neutralizeFormula('\tTAB_INJECT')).toBe("'\tTAB_INJECT");
    expect(csvService.neutralizeFormula('\rRETURN_INJECT')).toBe("'\rRETURN_INJECT");

    // Safe strings remain untouched
    expect(csvService.neutralizeFormula('John Doe')).toBe('John Doe');
    expect(csvService.neutralizeFormula('john.doe@example.com')).toBe('john.doe@example.com');
    expect(csvService.neutralizeFormula('')).toBe('');
    expect(csvService.neutralizeFormula(null)).toBe('');
  });

  // =========================================================================
  // TEST 2: TWO-PHASE IMMUTABLE SNAPSHOT EXPORT WITH FORMULA NEUTRALIZATION
  // =========================================================================
  it('2. Snapshot Export: Generates chunked export with formula neutralization and SHA-256 integrity checksum', async () => {
    // 1. Seed contacts in Tenant A, including one with formula injection payload
    await db.query(
      `INSERT INTO public.contacts (id, tenant_id, first_name, last_name, email, phone, job_title)
       VALUES ($1, $2, '=HYPERLINK("http://evil.com")', 'Hacker', 'evil@phish.com', '+1-555-0199', 'Security Threat'),
              ($3, $4, 'Normal', 'Contact', 'normal@acme.com', '555-1234', 'Manager')`,
      [crypto.randomUUID(), tenantAId, crypto.randomUUID(), tenantAId],
    );

    // 2. Admin triggers export
    const snapshot = await csvService.createExportSnapshot(tenantAId, adminAContext, 'contacts', db);

    expect(snapshot.id).toBeDefined();
    expect(snapshot.status).toBe('COMPLETED');
    expect(snapshot.totalChunks).toBeGreaterThanOrEqual(1);
    expect(snapshot.sha256Checksum).toBeDefined();

    // 3. Retrieve and download assembled CSV
    const download = await csvService.getExportSnapshot(tenantAId, snapshot.id, db);
    expect(download.csvContent).toBeDefined();

    // Verify formula neutralization applied: '=HYPERLINK' must be escaped as '=HYPERLINK'
    expect(download.csvContent).toContain("'=HYPERLINK");
    expect(download.csvContent).toContain("'+1-555-0199");
    expect(download.csvContent).toContain('"Normal"');
  });

  // =========================================================================
  // TEST 3: EXPORT WORKER AUTHORIZATION RECHECK & SECURITY AUDIT ALERT
  // =========================================================================
  it('3. Export Authorization Recheck: Non-admin users are rejected and security alerts are logged', async () => {
    // 1. Sales rep (member role) attempts to export contacts
    await expect(
      csvService.createExportSnapshot(tenantAId, memberAContext, 'contacts', db),
    ).rejects.toThrow(ForbiddenException);

    // 2. Verify security audit alert was recorded in audit_logs
    const alerts = await db.query(
      `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'SECURITY_ALERT'`,
      [tenantAId],
    );
    expect(alerts.rows.length).toBeGreaterThanOrEqual(1);
    const alert: any = alerts.rows[0];
    const diff = typeof alert.diff === 'string' ? JSON.parse(alert.diff) : alert.diff;
    expect(diff.action).toBe('EXPORT_ATTEMPT_DENIED');
  });

  // =========================================================================
  // TEST 4: CHUNKED RESUMABLE IMPORT — SKIP DEDUPLICATION MODE
  // =========================================================================
  it('4. Resumable Import (SKIP Mode): Ingests contacts and skips existing emails', async () => {
    // 1. Seed existing contact in Tenant A
    await db.query(
      `INSERT INTO public.contacts (id, tenant_id, first_name, last_name, email)
       VALUES (gen_random_uuid(), $1, 'Existing', 'User', 'alice@existing.com')`,
      [tenantAId],
    );

    // 2. CSV containing 1 duplicate and 2 new contacts
    const csvData = `firstName,lastName,email,phone,jobTitle
Bob,Existing,alice@existing.com,555-0000,New Title
Charlie,Brown,charlie@peanuts.com,555-0001,Director
Lucy,VanPelt,lucy@peanuts.com,555-0002,Manager`;

    // 3. Create import job
    const job = await csvService.createImportJob(
      tenantAId,
      adminAContext,
      { deduplicationMode: 'SKIP', csvData },
      db,
    );
    expect(job.totalRows).toBe(3);
    expect(job.status).toBe('PENDING');

    // 4. Process chunk
    const updated = await csvService.processImportChunk(tenantAId, adminAContext, job.id, 10, db);
    expect(updated.status).toBe('COMPLETED');
    expect(updated.processedRows).toBe(3);
    expect(updated.successfulRows).toBe(3);

    // Verify 'Existing User' was NOT modified (SKIP mode)
    const existing = await db.query(
      `SELECT first_name, phone FROM public.contacts WHERE tenant_id = $1 AND email = 'alice@existing.com'`,
      [tenantAId],
    );
    expect((existing.rows[0] as any).first_name).toBe('Existing');
    expect((existing.rows[0] as any).phone).toBeNull();

    // Verify new contacts created
    const charlie = await db.query(
      `SELECT * FROM public.contacts WHERE tenant_id = $1 AND email = 'charlie@peanuts.com'`,
      [tenantAId],
    );
    expect(charlie.rows.length).toBe(1);
  });

  // =========================================================================
  // TEST 5: CHUNKED RESUMABLE IMPORT — UPDATE DEDUPLICATION MODE
  // =========================================================================
  it('5. Resumable Import (UPDATE Mode): Overwrites existing contacts matching email', async () => {
    // 1. Seed existing contact
    await db.query(
      `INSERT INTO public.contacts (id, tenant_id, first_name, last_name, email, phone)
       VALUES (gen_random_uuid(), $1, 'OldName', 'OldLast', 'target@update.com', '111-1111')`,
      [tenantAId],
    );

    // 2. CSV updating the contact
    const csvData = `firstName,lastName,email,phone,jobTitle
UpdatedFirst,UpdatedLast,target@update.com,999-9999,Senior VP`;

    const job = await csvService.createImportJob(
      tenantAId,
      adminAContext,
      { deduplicationMode: 'UPDATE', csvData },
      db,
    );

    await csvService.processImportChunk(tenantAId, adminAContext, job.id, 10, db);

    // Verify contact was updated
    const updated = await db.query(
      `SELECT first_name, last_name, phone, job_title FROM public.contacts WHERE tenant_id = $1 AND email = 'target@update.com'`,
      [tenantAId],
    );
    const updatedRow: any = updated.rows[0];
    expect(updatedRow.first_name).toBe('UpdatedFirst');
    expect(updatedRow.last_name).toBe('UpdatedLast');
    expect(updatedRow.phone).toBe('999-9999');
    expect(updatedRow.job_title).toBe('Senior VP');
  });

  // =========================================================================
  // TEST 6: CRASH RESUMPTION (RE-ENTRANCY WITHOUT DUPLICATION)
  // =========================================================================
  it('6. Crash Resumption: Resuming interrupted import continues from exact processed_rows index', async () => {
    const csvData = `firstName,lastName,email
User1,Test,user1@test.com
User2,Test,user2@test.com
User3,Test,user3@test.com
User4,Test,user4@test.com`;

    // 1. Create job with 4 rows
    const job = await csvService.createImportJob(
      tenantAId,
      adminAContext,
      { deduplicationMode: 'SKIP', csvData },
      db,
    );
    expect(job.totalRows).toBe(4);

    // 2. Process first chunk of size 2 (simulating process crash after chunk 1)
    const chunk1 = await csvService.processImportChunk(tenantAId, adminAContext, job.id, 2, db);
    expect(chunk1.processedRows).toBe(2);
    expect(chunk1.status).toBe('PROCESSING');

    // Verify exactly 2 contacts created so far
    const count1 = await db.query(
      `SELECT COUNT(*)::int AS count FROM public.contacts WHERE tenant_id = $1 AND email LIKE '%@test.com'`,
      [tenantAId],
    );
    expect((count1.rows[0] as any).count).toBe(2);

    // 3. Resume job processing with chunk size 2 (processes remaining User3 and User4)
    const chunk2 = await csvService.processImportChunk(tenantAId, adminAContext, job.id, 2, db);
    expect(chunk2.processedRows).toBe(4);
    expect(chunk2.status).toBe('COMPLETED');

    // Verify all 4 unique contacts exist, with zero duplicate rows
    const count2 = await db.query(
      `SELECT COUNT(*)::int AS count FROM public.contacts WHERE tenant_id = $1 AND email LIKE '%@test.com'`,
      [tenantAId],
    );
    expect((count2.rows[0] as any).count).toBe(4);
  });

  // =========================================================================
  // TEST 7: TENANT ISOLATION ON EXPORTS & IMPORTS
  // =========================================================================
  it('7. Tenant Isolation: Tenant A cannot access Tenant B exports or imports', async () => {
    // 1. Tenant A creates export snapshot
    const snapshotA = await csvService.createExportSnapshot(tenantAId, adminAContext, 'contacts', db);

    // 2. Tenant B attempts to fetch Tenant A snapshot
    await expect(
      csvService.getExportSnapshot(tenantBId, snapshotA.id, db),
    ).rejects.toThrow(NotFoundException);

    // 3. Tenant A creates import job
    const jobA = await csvService.createImportJob(
      tenantAId,
      adminAContext,
      { deduplicationMode: 'SKIP', csvData: 'firstName,lastName,email\nT,A,t@a.com' },
      db,
    );

    // 4. Tenant B attempts to process Tenant A import job
    await expect(
      csvService.processImportChunk(tenantBId, adminBContext, jobA.id, 10, db),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // TEST 8: RBAC MUTATION RESTRICTION (READ-ONLY ROLE DENIAL)
  // =========================================================================
  it('8. RBAC Denial: Read-only user is denied contact import', async () => {
    await expect(
      csvService.createImportJob(
        tenantAId,
        readOnlyAContext,
        { deduplicationMode: 'SKIP', csvData: 'firstName,lastName,email\nReadOnly,User,ro@test.com' },
        db,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
