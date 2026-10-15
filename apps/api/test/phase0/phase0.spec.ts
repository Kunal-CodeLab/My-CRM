import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from './pglite-runner';
import { TenantConnectionManager, InvalidTenantContextException } from '../../src/database/tenant-connection-manager';

describe('Phase 0: Database & Tenant Isolation Security Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  // 1. SQL Injection Prevention in Parameterized Queries
  it('1. SQL Injection Prevention: Parameterized queries neutralize GUC alteration payloads', async () => {
    const maliciousPayload = "'; SET app.current_tenant_id = '01924b10-6bc7-7f8e-a2b1-000000000000'; --";
    
    // Parameterized insert
    await db.query(
      `INSERT INTO public.organizations (id, name, slug) VALUES ($1, $2, $3)`,
      ['01924b10-6bc7-7f8e-a2b1-111111111111', maliciousPayload, 'acme-sql-injection-test']
    );

    const result = await db.query(
      `SELECT name FROM public.organizations WHERE slug = $1`,
      ['acme-sql-injection-test']
    );

    // Assert literal string stored, not executed as SQL
    expect(result.rows[0].name).toBe(maliciousPayload);

    // Assert session setting was not altered
    const guc = await db.query(`SELECT current_setting('app.current_tenant_id', true) as tid`);
    expect(guc.rows[0].tid || '').toBe('');
  });

  // 2. Cross-Tenant Isolation with Valid Tenant Contexts
  it('2. Cross-Tenant Isolation: Tenant A cannot read Tenant B records under RLS', async () => {
    const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
    const tenantB = '01924b10-6bc7-7f8e-a2b1-bbbbbbbbbbbb';
    const pipelineA = '01924b10-6bc7-7f8e-a2b1-0000000000a1';
    const stageA = '01924b10-6bc7-7f8e-a2b1-0000000000a2';
    const pipelineB = '01924b10-6bc7-7f8e-a2b1-0000000000b1';
    const stageB = '01924b10-6bc7-7f8e-a2b1-0000000000b2';

    // Provision Tenant A and Tenant B organizations
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant A', 'tenant-a')`, [tenantA]);
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant B', 'tenant-b')`, [tenantB]);

    // Provision Pipeline and Stage for Tenant A, and insert Deal
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantA]);
    await db.query(`INSERT INTO public.pipelines (id, tenant_id, name) VALUES ($1, $2, 'Sales Pipeline A')`, [pipelineA, tenantA]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order) VALUES ($1, $2, $3, 'Qualified', 1)`, [stageA, tenantA, pipelineA]);
    await db.query(`
      INSERT INTO public.deals (id, tenant_id, title, value, currency, pipeline_id, stage_id)
      VALUES ('01924b10-6bc7-7f8e-a2b1-111111111111', $1, 'Deal Tenant A', 50000.00, 'USD', $2, $3)
    `, [tenantA, pipelineA, stageA]);
    await db.exec(`COMMIT;`);

    // Provision Pipeline and Stage for Tenant B, and insert Deal
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantB]);
    await db.query(`INSERT INTO public.pipelines (id, tenant_id, name) VALUES ($1, $2, 'Sales Pipeline B')`, [pipelineB, tenantB]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order) VALUES ($1, $2, $3, 'Negotiation', 1)`, [stageB, tenantB, pipelineB]);
    await db.query(`
      INSERT INTO public.deals (id, tenant_id, title, value, currency, pipeline_id, stage_id)
      VALUES ('01924b10-6bc7-7f8e-a2b1-222222222222', $1, 'Deal Tenant B', 75000.00, 'USD', $2, $3)
    `, [tenantB, pipelineB, stageB]);
    await db.exec(`COMMIT;`);

    // Switch to application role to enforce non-superuser RLS
    await db.exec(`SET ROLE crm_app_user;`);

    // Query as Tenant A: Must only see Tenant A's deal
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantA]);
    const dealsForA = await db.query(`SELECT title FROM public.deals`);
    await db.exec(`COMMIT;`);

    expect(dealsForA.rows).toHaveLength(1);
    expect(dealsForA.rows[0].title).toBe('Deal Tenant A');

    // Query as Tenant B: Must only see Tenant B's deal
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantB]);
    const dealsForB = await db.query(`SELECT title FROM public.deals`);
    await db.exec(`COMMIT;`);

    expect(dealsForB.rows).toHaveLength(1);
    expect(dealsForB.rows[0].title).toBe('Deal Tenant B');

    await db.exec(`RESET ROLE;`);
  });

  // 3. Missing or Invalid Tenant Context Fails Closed
  it('3. Fail-Closed Security: Missing or empty tenant context returns 0 rows', async () => {
    const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
    const pipelineA = '01924b10-6bc7-7f8e-a2b1-0000000000a1';
    const stageA = '01924b10-6bc7-7f8e-a2b1-0000000000a2';
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant A', 'tenant-a-fc')`, [tenantA]);

    // Insert record with context
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantA]);
    await db.query(`INSERT INTO public.pipelines (id, tenant_id, name) VALUES ($1, $2, 'Pipeline FC')`, [pipelineA, tenantA]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order) VALUES ($1, $2, $3, 'Stage FC', 1)`, [stageA, tenantA, pipelineA]);
    await db.query(`
      INSERT INTO public.deals (id, tenant_id, title, value, currency, pipeline_id, stage_id)
      VALUES ('01924b10-6bc7-7f8e-a2b1-333333333333', $1, 'Secret Deal', 100000.00, 'USD', $2, $3)
    `, [tenantA, pipelineA, stageA]);
    await db.exec(`COMMIT;`);

    // Switch to application role to enforce non-superuser RLS
    await db.exec(`SET ROLE crm_app_user;`);

    // Query without setting tenant context (missing context)
    await db.exec(`BEGIN;`);
    const resultNoContext = await db.query(`SELECT * FROM public.deals`);
    await db.exec(`COMMIT;`);

    // Must return 0 rows (fails closed)
    expect(resultNoContext.rows).toHaveLength(0);

    // Query with empty string context
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', '', true)`);
    const resultEmptyContext = await db.query(`SELECT * FROM public.deals`);
    await db.exec(`COMMIT;`);

    expect(resultEmptyContext.rows).toHaveLength(0);

    await db.exec(`RESET ROLE;`);

    // Test TenantConnectionManager validator rejection on invalid syntax
    const manager = new TenantConnectionManager({} as any);
    expect(() => manager.validateTenantId('not-a-valid-uuid')).toThrow(InvalidTenantContextException);
    expect(() => manager.validateTenantId('')).toThrow(InvalidTenantContextException);
    expect(() => manager.validateTenantId(null)).toThrow(InvalidTenantContextException);
  });

  // 4. Partitioned Audit Logging: Direct Child-Partition Access Denial & Append-Only Invariant
  it('4. Audit Immutability & Child Partition Denial: Direct access denied to crm_app_user and append-only trigger enforced', async () => {
    const tenantId = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
    const auditId = '01924b10-6bc7-7f8e-a2b1-444444444444';
    const recordTimestamp = '2026-10-15T12:00:00Z';

    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Audit Org', 'audit-org')`, [tenantId]);

    // Insert an audit log row into the October partition via parent table under crm_app_user
    await db.exec(`SET ROLE crm_app_user;`);
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await db.query(`
      INSERT INTO public.audit_logs (id, tenant_id, actor_id, entity_name, entity_id, action, diff, entry_hash, created_at)
      VALUES ($1, $2, gen_random_uuid(), 'deal', gen_random_uuid(), 'INSERT', '{"title": "Initial"}'::jsonb, 'hash123', $3)
    `, [auditId, tenantId, recordTimestamp]);
    await db.exec(`COMMIT;`);

    // Criterion 4: Direct application-role access to audit child partitions being denied
    await expect(
      db.query(`SELECT * FROM public.audit_logs_y2026m10`)
    ).rejects.toThrow(/permission denied for table audit_logs_y2026m10/);

    // Parent table SELECT works under crm_app_user inside tenant context
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    const auditSelect = await db.query(`SELECT id, action FROM public.audit_logs WHERE id = $1`, [auditId]);
    await db.exec(`COMMIT;`);
    expect(auditSelect.rows).toHaveLength(1);
    expect(auditSelect.rows[0].action).toBe('INSERT');

    // Attempt to UPDATE the audit record: Must be denied (via trigger or privilege)
    await expect(
      db.query(`UPDATE public.audit_logs SET action = 'ALTERED' WHERE id = $1`, [auditId])
    ).rejects.toThrow();

    // Attempt to DELETE the audit record: Must be denied (via trigger or privilege)
    await expect(
      db.query(`DELETE FROM public.audit_logs WHERE id = $1`, [auditId])
    ).rejects.toThrow();

    await db.exec(`RESET ROLE;`);
  });

  // 5. Database Schema & Composite Foreign Key Integrity
  it('5. Relational Integrity: Cross-tenant foreign key links are rejected by composite constraints', async () => {
    const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
    const tenantB = '01924b10-6bc7-7f8e-a2b1-bbbbbbbbbbbb';
    const accountA = '01924b10-6bc7-7f8e-a2b1-a11111111111';

    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant A', 'tenant-a-fk')`, [tenantA]);
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant B', 'tenant-b-fk')`, [tenantB]);

    // Create Account for Tenant A
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantA]);
    await db.query(`
      INSERT INTO public.accounts (id, tenant_id, name) VALUES ($1, $2, 'Account A')
    `, [accountA, tenantA]);
    await db.exec(`COMMIT;`);

    // Switch to application role
    await db.exec(`SET ROLE crm_app_user;`);

    // Attempt to create Contact in Tenant B linking to Account A (Cross-tenant link)
    // Must be rejected by composite foreign key: (tenant_id, account_id) REFERENCES accounts(tenant_id, id)
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantB]);
    await expect(
      db.query(`
        INSERT INTO public.contacts (id, tenant_id, account_id, first_name, last_name)
        VALUES (gen_random_uuid(), $1, $2, 'John', 'Doe')
      `, [tenantB, accountA])
    ).rejects.toThrow(/violates foreign key constraint/);
    await db.exec(`ROLLBACK;`);

    await db.exec(`RESET ROLE;`);
  });

  // 6. Tenant-Context Cleanup and Connection Pool Reuse
  it('6. Connection Pool Hygiene: SET LOCAL does not leak across transaction boundaries', async () => {
    const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';

    // Transaction 1: Set tenant context
    await db.exec(`BEGIN;`);
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantA]);
    const ctx1 = await db.query(`SELECT current_setting('app.current_tenant_id', true) as tid`);
    expect(ctx1.rows[0].tid).toBe(tenantA);
    await db.exec(`COMMIT;`);

    // Transaction 2 (simulating connection returned to pool): Must have clean state
    await db.exec(`BEGIN;`);
    const ctx2 = await db.query(`SELECT current_setting('app.current_tenant_id', true) as tid`);
    expect(ctx2.rows[0].tid).toBe('');
    await db.exec(`COMMIT;`);
  });
});
