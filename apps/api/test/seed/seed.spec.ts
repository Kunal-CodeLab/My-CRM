import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../phase0/pglite-runner';
import { PasswordHasher } from '../../src/auth/password-hasher';

describe('Deterministic Database Seeding & Bootstrap Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  it('1. Schema Baseline: All required relational tables exist after migrations', async () => {
    const res = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`
    );
    const tableNames = res.rows.map((r) => r.tablename);

    expect(tableNames).toContain('organizations');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('memberships');
    expect(tableNames).toContain('tenant_quotas');
    expect(tableNames).toContain('pipelines');
    expect(tableNames).toContain('deal_stages');
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('contacts');
    expect(tableNames).toContain('deals');
    expect(tableNames).toContain('activities');
    expect(tableNames).toContain('outbox_events');
    expect(tableNames).toContain('audit_logs');
  });

  it('2. Argon2id Password Cryptography: Hashes and validates default credentials', async () => {
    const plain = 'Password123!';
    const hash = await PasswordHasher.hash(plain);

    expect(hash).toMatch(/^\$argon2id\$/);

    const isValid = await PasswordHasher.verify(plain, hash);
    expect(isValid).toBe(true);

    const isInvalid = await PasswordHasher.verify('WrongPassword999', hash);
    expect(isInvalid).toBe(false);
  });

  it('3. Relational Seeding Integrity: Populates multi-tenant domain without constraint violations', async () => {
    const orgId = '018f4a12-0000-7000-8000-000000000001';
    const aliceId = '018f4a12-0000-7000-8000-000000000011';
    const bobId = '018f4a12-0000-7000-8000-000000000012';
    const pipelineId = '018f4a12-0000-7000-8000-000000000031';
    const stageWonId = '018f4a12-0000-7000-8000-000000000045';
    const accountId = '018f4a12-0000-7000-8000-000000000051';
    const contactId = '018f4a12-0000-7000-8000-000000000061';
    const dealId = '018f4a12-0000-7000-8000-000000000071';

    const hash = await PasswordHasher.hash('Password123!');

    // Insert Organization
    await db.query(
      `INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Acme Corporation', 'acme-corp')`,
      [orgId]
    );

    // Insert Users
    await db.query(
      `INSERT INTO public.users (id, email, password_hash, first_name, last_name, is_superadmin)
       VALUES ($1, 'admin@acme.com', $2, 'Alice', 'Admin', true),
              ($3, 'sales@acme.com', $2, 'Bob', 'Rep', false)`,
      [aliceId, hash, bobId]
    );

    // Insert Memberships
    await db.query(
      `INSERT INTO public.memberships (id, tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'active'),
              ($4, $2, $5, 'member', 'active')`,
      ['018f4a12-0000-7000-8000-000000000021', orgId, aliceId, '018f4a12-0000-7000-8000-000000000022', bobId]
    );

    // Insert Pipeline
    await db.query(
      `INSERT INTO public.pipelines (id, tenant_id, name, is_default)
       VALUES ($1, $2, 'Direct Enterprise Pipeline', true)`,
      [pipelineId, orgId]
    );

    // Insert Won Stage
    await db.query(
      `INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost)
       VALUES ($1, $2, $3, 'Closed Won', 4, 100, true, false)`,
      [stageWonId, orgId, pipelineId]
    );

    // Insert Account
    await db.query(
      `INSERT INTO public.accounts (id, tenant_id, owner_id, name, domain, industry, annual_revenue)
       VALUES ($1, $2, $3, 'Cyberdyne Systems', 'cyberdyne.com', 'Robotics & AI', 25000000.00)`,
      [accountId, orgId, bobId]
    );

    // Insert Contact
    await db.query(
      `INSERT INTO public.contacts (id, tenant_id, account_id, owner_id, firstName, lastName, email, phone)
       VALUES ($1, $2, $3, $4, 'Sarah', 'Connor', 's.connor@cyberdyne.com', '+1-555-0199')`
        .replace('firstName', 'first_name')
        .replace('lastName', 'last_name'),
      [contactId, orgId, accountId, bobId]
    );

    // Insert Deal
    await db.query(
      `INSERT INTO public.deals (id, tenant_id, pipeline_id, stage_id, account_id, primary_contact_id, owner_id, title, value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Defense License', 150000.00)`,
      [dealId, orgId, pipelineId, stageWonId, accountId, contactId, bobId]
    );

    // Query deal with joins to verify all foreign keys resolved perfectly
    const dealRes = await db.query<any>(
      `SELECT d.id, d.title, d.value, o.name as org_name, a.name as account_name, c.first_name, s.name as stage_name
       FROM public.deals d
       JOIN public.organizations o ON d.tenant_id = o.id
       JOIN public.accounts a ON d.account_id = a.id
       JOIN public.contacts c ON d.primary_contact_id = c.id
       JOIN public.deal_stages s ON d.stage_id = s.id
       WHERE d.id = $1`,
      [dealId]
    );

    expect(dealRes.rows).toHaveLength(1);
    expect(dealRes.rows[0].org_name).toBe('Acme Corporation');
    expect(dealRes.rows[0].account_name).toBe('Cyberdyne Systems');
    expect(dealRes.rows[0].first_name).toBe('Sarah');
    expect(dealRes.rows[0].stage_name).toBe('Closed Won');
  });
});
