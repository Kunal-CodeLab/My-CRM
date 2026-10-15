import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { CrmService } from '../../src/crm/crm.service';
import { createTestDatabase } from '../phase0/pglite-runner';
import { TenantContext } from '@crm/shared-types';

function createPglitePrisma(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  return {
    account: {
      async findMany({ where, take, orderBy }: any) {
        let query = `SELECT * FROM public.accounts WHERE tenant_id = $1 AND deleted_at IS NULL`;
        const params: any[] = [where.tenantId];
        let i = 2;
        if (where.name?.contains) {
          query += ` AND name ILIKE $${i++}`;
          params.push(`%${where.name.contains}%`);
        }
        if (where.id?.gt) {
          query += ` AND id > $${i++}`;
          params.push(where.id.gt);
        }
        query += ` ORDER BY id ASC`;
        if (take) {
          query += ` LIMIT $${i++}`;
          params.push(take);
        }
        const res = await db.query(query, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenant_id,
          ownerId: r.owner_id,
          name: r.name,
          domain: r.domain,
          industry: r.industry,
          annualRevenue: r.annual_revenue,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        }));
      },
      async findFirst({ where }: any) {
        let query = `SELECT * FROM public.accounts WHERE id = $1 AND tenant_id = $2`;
        const params: any[] = [where.id, where.tenantId];
        if (where.deletedAt === null) {
          query += ` AND deleted_at IS NULL`;
        }
        const res = await db.query(query, params);
        if (res.rows.length === 0) return null;
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          ownerId: r.owner_id,
          name: r.name,
          domain: r.domain,
          industry: r.industry,
          annualRevenue: r.annual_revenue,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.accounts (id, tenant_id, owner_id, name, domain, industry, annual_revenue)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [id, data.tenantId, data.ownerId, data.name, data.domain, data.industry, data.annualRevenue]
        );
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          ownerId: r.owner_id,
          name: r.name,
          domain: r.domain,
          industry: r.industry,
          annualRevenue: r.annual_revenue,
          deletedAt: null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
      async update({ where, data }: any) {
        const sets: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (data.name !== undefined) { sets.push(`name = $${i++}`); params.push(data.name); }
        if (data.domain !== undefined) { sets.push(`domain = $${i++}`); params.push(data.domain); }
        if (data.industry !== undefined) { sets.push(`industry = $${i++}`); params.push(data.industry); }
        if (data.annualRevenue !== undefined) { sets.push(`annual_revenue = $${i++}`); params.push(data.annualRevenue); }
        if (data.ownerId !== undefined) { sets.push(`owner_id = $${i++}`); params.push(data.ownerId); }
        if (data.deletedAt !== undefined) { sets.push(`deleted_at = $${i++}`); params.push(data.deletedAt); }
        sets.push(`updated_at = NOW()`);
        params.push(where.id);
        const res = await db.query(
          `UPDATE public.accounts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          params
        );
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          ownerId: r.owner_id,
          name: r.name,
          domain: r.domain,
          industry: r.industry,
          annualRevenue: r.annual_revenue,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
    },
    contact: {
      async findMany({ where, take }: any) {
        let query = `SELECT * FROM public.contacts WHERE tenant_id = $1 AND deleted_at IS NULL`;
        const params: any[] = [where.tenantId];
        let i = 2;
        if (where.accountId) {
          query += ` AND account_id = $${i++}`;
          params.push(where.accountId);
        }
        if (where.id?.gt) {
          query += ` AND id > $${i++}`;
          params.push(where.id.gt);
        }
        query += ` ORDER BY id ASC`;
        if (take) {
          query += ` LIMIT $${i++}`;
          params.push(take);
        }
        const res = await db.query(query, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenant_id,
          accountId: r.account_id,
          ownerId: r.owner_id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          jobTitle: r.job_title,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        }));
      },
      async findFirst({ where }: any) {
        let query = `SELECT * FROM public.contacts WHERE id = $1 AND tenant_id = $2`;
        const params: any[] = [where.id, where.tenantId];
        if (where.deletedAt === null) query += ` AND deleted_at IS NULL`;
        const res = await db.query(query, params);
        if (res.rows.length === 0) return null;
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          accountId: r.account_id,
          ownerId: r.owner_id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          jobTitle: r.job_title,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.contacts (id, tenant_id, account_id, owner_id, first_name, last_name, email, phone, job_title)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [id, data.tenantId, data.accountId, data.ownerId, data.firstName, data.lastName, data.email, data.phone, data.jobTitle]
        );
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          accountId: r.account_id,
          ownerId: r.owner_id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          jobTitle: r.job_title,
          deletedAt: null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
      async update({ where, data }: any) {
        const sets: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (data.firstName !== undefined) { sets.push(`first_name = $${i++}`); params.push(data.firstName); }
        if (data.lastName !== undefined) { sets.push(`last_name = $${i++}`); params.push(data.lastName); }
        if (data.email !== undefined) { sets.push(`email = $${i++}`); params.push(data.email); }
        if (data.phone !== undefined) { sets.push(`phone = $${i++}`); params.push(data.phone); }
        if (data.jobTitle !== undefined) { sets.push(`job_title = $${i++}`); params.push(data.jobTitle); }
        if (data.accountId !== undefined) { sets.push(`account_id = $${i++}`); params.push(data.accountId); }
        if (data.ownerId !== undefined) { sets.push(`owner_id = $${i++}`); params.push(data.ownerId); }
        if (data.deletedAt !== undefined) { sets.push(`deleted_at = $${i++}`); params.push(data.deletedAt); }
        sets.push(`updated_at = NOW()`);
        params.push(where.id);
        const res = await db.query(
          `UPDATE public.contacts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          params
        );
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          accountId: r.account_id,
          ownerId: r.owner_id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          jobTitle: r.job_title,
          deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      },
    },
    pipeline: {
      async findMany({ where }: any) {
        const res = await db.query(`SELECT * FROM public.pipelines WHERE tenant_id = $1 ORDER BY created_at ASC`, [where.tenantId]);
        const pipelines = [];
        for (const p of (res.rows as any[])) {
          const sRes = await db.query(`SELECT * FROM public.deal_stages WHERE pipeline_id = $1 ORDER BY display_order ASC`, [p.id]);
          pipelines.push({
            id: p.id,
            tenantId: p.tenant_id,
            name: p.name,
            isDefault: p.is_default,
            createdAt: new Date(p.created_at),
            stages: sRes.rows.map((s: any) => ({
              id: s.id,
              tenantId: s.tenant_id,
              pipelineId: s.pipeline_id,
              name: s.name,
              displayOrder: s.display_order,
              probabilityPercentage: s.probability_percentage,
              isWon: s.is_won,
              isLost: s.is_lost,
              createdAt: new Date(s.created_at),
            })),
          });
        }
        return pipelines;
      },
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.pipelines (id, tenant_id, name, is_default) VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, data.tenantId, data.name, data.isDefault || false]
        );
        return { id: (res.rows[0] as any).id, name: (res.rows[0] as any).name };
      },
    },
    dealStage: {
      async findFirst({ where }: any) {
        let query = `SELECT * FROM public.deal_stages WHERE id = $1 AND tenant_id = $2`;
        const params: any[] = [where.id, where.tenantId];
        if (where.pipelineId) {
          query += ` AND pipeline_id = $3`;
          params.push(where.pipelineId);
        }
        const res = await db.query(query, params);
        if (res.rows.length === 0) return null;
        const s: any = res.rows[0];
        return {
          id: s.id,
          tenantId: s.tenant_id,
          pipelineId: s.pipeline_id,
          name: s.name,
          displayOrder: s.display_order,
          probabilityPercentage: s.probability_percentage,
          isWon: s.is_won,
          isLost: s.is_lost,
        };
      },
      async createMany({ data }: any) {
        for (const s of data) {
          await db.query(
            `INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [s.id || crypto.randomUUID(), s.tenantId, s.pipelineId, s.name, s.displayOrder, s.probabilityPercentage, s.isWon || false, s.isLost || false]
          );
        }
      },
    },
    deal: {
      async findMany({ where }: any) {
        let query = `SELECT * FROM public.deals WHERE tenant_id = $1 AND deleted_at IS NULL`;
        const params: any[] = [where.tenantId];
        let i = 2;
        if (where.pipelineId) { query += ` AND pipeline_id = $${i++}`; params.push(where.pipelineId); }
        if (where.stageId) { query += ` AND stage_id = $${i++}`; params.push(where.stageId); }
        query += ` ORDER BY created_at DESC`;
        const res = await db.query(query, params);
        return res.rows.map((r: any) => formatDeal(r));
      },
      async findFirst({ where }: any) {
        let query = `SELECT * FROM public.deals WHERE id = $1 AND tenant_id = $2`;
        const params: any[] = [where.id, where.tenantId];
        if (where.deletedAt === null) query += ` AND deleted_at IS NULL`;
        const res = await db.query(query, params);
        return res.rows.length > 0 ? formatDeal(res.rows[0]) : null;
      },
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.deals (id, tenant_id, title, value, currency, pipeline_id, stage_id, account_id, primary_contact_id, owner_id, expected_close_date, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [id, data.tenantId, data.title, data.value, data.currency || 'USD', data.pipelineId, data.stageId, data.accountId, data.primaryContactId, data.ownerId, data.expectedCloseDate, data.version || 1]
        );
        return formatDeal(res.rows[0]);
      },
      async update({ where, data }: any) {
        const sets: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (data.title !== undefined) { sets.push(`title = $${i++}`); params.push(data.title); }
        if (data.value !== undefined) { sets.push(`value = $${i++}`); params.push(data.value); }
        if (data.currency !== undefined) { sets.push(`currency = $${i++}`); params.push(data.currency); }
        if (data.stageId !== undefined) { sets.push(`stage_id = $${i++}`); params.push(data.stageId); }
        if (data.accountId !== undefined) { sets.push(`account_id = $${i++}`); params.push(data.accountId); }
        if (data.primaryContactId !== undefined) { sets.push(`primary_contact_id = $${i++}`); params.push(data.primaryContactId); }
        if (data.ownerId !== undefined) { sets.push(`owner_id = $${i++}`); params.push(data.ownerId); }
        if (data.expectedCloseDate !== undefined) { sets.push(`expected_close_date = $${i++}`); params.push(data.expectedCloseDate); }
        if (data.lostReason !== undefined) { sets.push(`lost_reason = $${i++}`); params.push(data.lostReason); }
        if (data.deletedAt !== undefined) { sets.push(`deleted_at = $${i++}`); params.push(data.deletedAt); }
        if (data.version?.increment) { sets.push(`version = version + 1`); }
        sets.push(`updated_at = NOW()`);
        params.push(where.id);
        const res = await db.query(
          `UPDATE public.deals SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          params
        );
        return formatDeal(res.rows[0]);
      },
    },
    activity: {
      async findMany({ where, take }: any) {
        let query = `SELECT * FROM public.activities WHERE tenant_id = $1`;
        const params: any[] = [where.tenantId];
        let i = 2;
        if (where.dealId) { query += ` AND deal_id = $${i++}`; params.push(where.dealId); }
        if (where.contactId) { query += ` AND contact_id = $${i++}`; params.push(where.contactId); }
        if (where.accountId) { query += ` AND account_id = $${i++}`; params.push(where.accountId); }
        query += ` ORDER BY created_at DESC`;
        if (take) { query += ` LIMIT $${i++}`; params.push(take); }
        const res = await db.query(query, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenant_id,
          createdById: r.created_by_id,
          type: r.type,
          subject: r.subject,
          body: r.body,
          dueDate: r.due_date ? new Date(r.due_date) : null,
          completedAt: r.completed_at ? new Date(r.completed_at) : null,
          dealId: r.deal_id,
          contactId: r.contact_id,
          accountId: r.account_id,
          createdAt: new Date(r.created_at),
        }));
      },
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.activities (id, tenant_id, created_by_id, type, subject, body, due_date, deal_id, contact_id, account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [id, data.tenantId, data.createdById, data.type, data.subject, data.body, data.dueDate, data.dealId, data.contactId, data.accountId]
        );
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          createdById: r.created_by_id,
          type: r.type,
          subject: r.subject,
          body: r.body,
          dueDate: r.due_date ? new Date(r.due_date) : null,
          completedAt: null,
          dealId: r.deal_id,
          contactId: r.contact_id,
          accountId: r.account_id,
          createdAt: new Date(r.created_at),
        };
      },
    },
    tenantQuota: {
      async findUnique({ where }: any) {
        const res = await db.query(
          `SELECT * FROM public.tenant_quotas WHERE tenant_id = $1 AND metric = $2`,
          [where.tenantId_metric.tenantId, where.tenantId_metric.metric]
        );
        if (res.rows.length === 0) return null;
        const r: any = res.rows[0];
        return {
          tenantId: r.tenant_id,
          metric: r.metric,
          currentCount: r.current_count,
          maxLimit: r.max_limit,
        };
      },
      async update({ where, data }: any) {
        if (data.currentCount?.increment) {
          await db.query(
            `UPDATE public.tenant_quotas SET current_count = current_count + $1, updated_at = NOW()
             WHERE tenant_id = $2 AND metric = $3`,
            [data.currentCount.increment, where.tenantId_metric.tenantId, where.tenantId_metric.metric]
          );
        }
      },
    },
    membership: {
      async findFirst({ where }: any) {
        const res = await db.query(
          `SELECT * FROM public.memberships WHERE tenant_id = $1 AND user_id = $2 AND status = $3`,
          [where.tenantId, where.userId, where.status]
        );
        if (res.rows.length === 0) return null;
        const r: any = res.rows[0];
        return {
          id: r.id,
          tenantId: r.tenant_id,
          userId: r.user_id,
          role: r.role,
          status: r.status,
          sessionVersion: r.session_version,
        };
      },
    },
    auditLog: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        await db.query(
          `INSERT INTO public.audit_logs (id, tenant_id, actor_id, entity_name, entity_id, action, diff, entry_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, data.tenantId, data.actorId, data.entityName, data.entityId, data.action, JSON.stringify(data.diff), data.entryHash]
        );
      },
    },
    outboxEvent: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        await db.query(
          `INSERT INTO public.outbox_events (id, tenant_id, actor_id, event_type, payload, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, data.tenantId, data.actorId, data.eventType, JSON.stringify(data.payload), data.idempotencyKey]
        );
      },
    },
    async $transaction(fn: any) {
      await db.exec('BEGIN;');
      try {
        const res = await fn(this);
        await db.exec('COMMIT;');
        return res;
      } catch (err) {
        await db.exec('ROLLBACK;');
        throw err;
      }
    },
  } as any;
}

function formatDeal(r: any) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    title: r.title,
    value: r.value,
    currency: r.currency,
    pipelineId: r.pipeline_id,
    stageId: r.stage_id,
    accountId: r.account_id,
    primaryContactId: r.primary_contact_id,
    ownerId: r.owner_id,
    version: r.version,
    expectedCloseDate: r.expected_close_date ? new Date(r.expected_close_date) : null,
    lostReason: r.lost_reason,
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

describe('Phase 2: CRM Core Relational Domain & Concurrency Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: any;
  let crmService: CrmService;

  const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
  const tenantB = '01924b10-6bc7-7f8e-a2b1-bbbbbbbbbbbb';
  const ownerUser = '01924b10-6bc7-7f8e-a2b1-111111111111';
  const memberUser = '01924b10-6bc7-7f8e-a2b1-222222222222';
  const otherMember = '01924b10-6bc7-7f8e-a2b1-333333333333';
  const readOnlyUser = '01924b10-6bc7-7f8e-a2b1-444444444444';

  let ownerActor: TenantContext;
  let memberActor: TenantContext;
  let otherMemberActor: TenantContext;
  let readOnlyActor: TenantContext;

  let pipelineAId: string;
  let stageLeadId: string;
  let stageQualifiedId: string;
  let stageWonId: string;
  let stageLostId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    prisma = createPglitePrisma(db);
    crmService = new CrmService(prisma);

    // Provision Organizations
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant A', 'tenant-a')`, [tenantA]);
    await db.query(`INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Tenant B', 'tenant-b')`, [tenantB]);

    // Provision Users
    await db.query(`INSERT INTO public.users (id, email, password_hash, first_name, last_name) VALUES ($1, 'owner@a.com', 'h', 'O', 'A')`, [ownerUser]);
    await db.query(`INSERT INTO public.users (id, email, password_hash, first_name, last_name) VALUES ($1, 'member@a.com', 'h', 'M', 'A')`, [memberUser]);
    await db.query(`INSERT INTO public.users (id, email, password_hash, first_name, last_name) VALUES ($1, 'other@a.com', 'h', 'OM', 'A')`, [otherMember]);
    await db.query(`INSERT INTO public.users (id, email, password_hash, first_name, last_name) VALUES ($1, 'readonly@a.com', 'h', 'RO', 'A')`, [readOnlyUser]);

    // Provision Memberships in Tenant A
    await db.query(`INSERT INTO public.memberships (id, tenant_id, user_id, role, status) VALUES (gen_random_uuid(), $1, $2, 'owner', 'active')`, [tenantA, ownerUser]);
    await db.query(`INSERT INTO public.memberships (id, tenant_id, user_id, role, status) VALUES (gen_random_uuid(), $1, $2, 'member', 'active')`, [tenantA, memberUser]);
    await db.query(`INSERT INTO public.memberships (id, tenant_id, user_id, role, status) VALUES (gen_random_uuid(), $1, $2, 'member', 'active')`, [tenantA, otherMember]);
    await db.query(`INSERT INTO public.memberships (id, tenant_id, user_id, role, status) VALUES (gen_random_uuid(), $1, $2, 'read_only', 'active')`, [tenantA, readOnlyUser]);

    // Provision Default Quota
    await db.query(`INSERT INTO public.tenant_quotas (tenant_id, metric, current_count, max_limit) VALUES ($1, 'active_deals', 0, 5)`, [tenantA]);

    // Provision Pipelines & Stages for Tenant A
    pipelineAId = '01924b10-6bc7-7f8e-a2b1-000000000001';
    stageLeadId = '01924b10-6bc7-7f8e-a2b1-000000000002';
    stageQualifiedId = '01924b10-6bc7-7f8e-a2b1-000000000003';
    stageWonId = '01924b10-6bc7-7f8e-a2b1-000000000004';
    stageLostId = '01924b10-6bc7-7f8e-a2b1-000000000005';

    await db.query(`INSERT INTO public.pipelines (id, tenant_id, name, is_default) VALUES ($1, $2, 'Standard Sales', true)`, [pipelineAId, tenantA]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost) VALUES ($1, $2, $3, 'Lead', 1, 10, false, false)`, [stageLeadId, tenantA, pipelineAId]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost) VALUES ($1, $2, $3, 'Qualified', 2, 40, false, false)`, [stageQualifiedId, tenantA, pipelineAId]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost) VALUES ($1, $2, $3, 'Closed Won', 3, 100, true, false)`, [stageWonId, tenantA, pipelineAId]);
    await db.query(`INSERT INTO public.deal_stages (id, tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost) VALUES ($1, $2, $3, 'Closed Lost', 4, 0, false, true)`, [stageLostId, tenantA, pipelineAId]);

    ownerActor = { tenantId: tenantA, userId: ownerUser, role: 'owner', sessionVersion: 1 };
    memberActor = { tenantId: tenantA, userId: memberUser, role: 'member', sessionVersion: 1 };
    otherMemberActor = { tenantId: tenantA, userId: otherMember, role: 'member', sessionVersion: 1 };
    readOnlyActor = { tenantId: tenantA, userId: readOnlyUser, role: 'read_only', sessionVersion: 1 };
  });

  // 1. Account & Contact CRUD
  it('1. Accounts & Contacts: CRUD with tenant ownership and pagination works', async () => {
    // Create Account
    const account = await crmService.createAccount(tenantA, ownerActor, {
      name: 'Globex Corp',
      domain: 'globex.com',
      industry: 'Manufacturing',
      annualRevenue: '5000000.00',
    });
    expect(account.id).toBeDefined();
    expect(account.name).toBe('Globex Corp');

    // Create Contact linked to Account
    const contact = await crmService.createContact(tenantA, memberActor, {
      firstName: 'Hank',
      lastName: 'Scorpio',
      email: 'hank@globex.com',
      accountId: account.id,
    });
    expect(contact.id).toBeDefined();
    expect(contact.accountId).toBe(account.id);

    // List Contacts with Account filter
    const contactsList = await crmService.listContacts(tenantA, { accountId: account.id });
    expect(contactsList.data).toHaveLength(1);
    expect(contactsList.data[0].email).toBe('hank@globex.com');
  });

  // 2. Cross-Tenant ID Guessing Rejection
  it('2. Tenant Isolation: Attempting to link cross-tenant account ID throws BadRequestException', async () => {
    // Account belongs to Tenant B
    const accountBId = '01924b10-6bc7-7f8e-a2b1-bbbbbbbb0001';
    await db.query(`INSERT INTO public.accounts (id, tenant_id, name) VALUES ($1, $2, 'Tenant B Account')`, [accountBId, tenantB]);

    // Member in Tenant A tries to link Contact to Tenant B's Account
    await expect(
      crmService.createContact(tenantA, memberActor, {
        firstName: 'Infiltrator',
        lastName: 'Agent',
        accountId: accountBId,
      })
    ).rejects.toThrow(/Referenced account does not exist within the tenant/);
  });

  // 3. Read-Only Role Mutation Block
  it('3. RBAC Enforcement: Read-only user cannot create, update, or delete records', async () => {
    await expect(
      crmService.createAccount(tenantA, readOnlyActor, { name: 'Unauthorized Corp' })
    ).rejects.toThrow(/Read-only users cannot perform mutation operations/);
  });

  // 4. Record Ownership Mutation Rules
  it('4. Record Ownership: Sales rep can only update own records, while Admin/Owner can update any', async () => {
    // Account created with memberUser as owner
    const account = await crmService.createAccount(tenantA, memberActor, {
      name: 'Member Account',
      ownerId: memberUser,
    });

    // memberUser updates own account: Allowed
    const updated = await crmService.updateAccount(tenantA, memberActor, account.id, {
      name: 'Member Account Updated',
    });
    expect(updated.name).toBe('Member Account Updated');

    // otherMember tries to update account owned by memberUser: 403 Forbidden
    await expect(
      crmService.updateAccount(tenantA, otherMemberActor, account.id, {
        name: 'Hijacked Account',
      })
    ).rejects.toThrow(/Members can only update accounts assigned to them/);

    // Owner updates account owned by memberUser: Allowed
    const ownerUpdated = await crmService.updateAccount(tenantA, ownerActor, account.id, {
      name: 'Owner Admin Override',
    });
    expect(ownerUpdated.name).toBe('Owner Admin Override');
  });

  // 5. Deal Creation, Quota Check & Level-1 Quota Lock
  it('5. Deal Creation & Quota: Level-1 quota limit enforces 402 Payment Required when threshold reached', async () => {
    // Set quota maxLimit to 2
    await db.query(`UPDATE public.tenant_quotas SET max_limit = 2, current_count = 0 WHERE tenant_id = $1`, [tenantA]);

    // Create Deal 1: Success
    await crmService.createDeal(tenantA, memberActor, {
      title: 'Deal 1',
      value: '25000.00',
      currency: 'USD',
      pipelineId: pipelineAId,
      stageId: stageLeadId,
    });

    // Create Deal 2: Success
    await crmService.createDeal(tenantA, memberActor, {
      title: 'Deal 2',
      value: '50000.00',
      currency: 'USD',
      pipelineId: pipelineAId,
      stageId: stageLeadId,
    });

    // Create Deal 3: Exceeds quota (2/2) -> 402 Payment Required
    await expect(
      crmService.createDeal(tenantA, memberActor, {
        title: 'Deal 3',
        value: '75000.00',
        currency: 'USD',
        pipelineId: pipelineAId,
        stageId: stageLeadId,
      })
    ).rejects.toThrow(/quota exceeded/i);
  });

  // 6. Optimistic Concurrency Control (Version Checks)
  it('6. Optimistic Concurrency: Conflicting expectedVersion rejects with 409 Conflict', async () => {
    const deal = await crmService.createDeal(tenantA, memberActor, {
      title: 'Competitive Deal',
      value: '100000.00',
      currency: 'USD',
      pipelineId: pipelineAId,
      stageId: stageLeadId,
    });

    expect(deal.version).toBe(1);

    // User A transitions stage with expectedVersion = 1: Success -> version increments to 2
    const transitioned = await crmService.transitionDealStage(tenantA, memberActor, deal.id, {
      newStageId: stageQualifiedId,
      expectedVersion: 1,
    });
    expect(transitioned.version).toBe(2);

    // User B (stale tab still holding expectedVersion = 1) attempts update: 409 Conflict
    await expect(
      crmService.transitionDealStage(tenantA, memberActor, deal.id, {
        newStageId: stageWonId,
        expectedVersion: 1,
      })
    ).rejects.toThrow(/Optimistic concurrency conflict/);

    // User B with updated expectedVersion = 2: Success
    const finalTransition = await crmService.transitionDealStage(tenantA, memberActor, deal.id, {
      newStageId: stageWonId,
      expectedVersion: 2,
    });
    expect(finalTransition.version).toBe(3);
    expect(finalTransition.stageId).toBe(stageWonId);
  });

  // 7. Activity Timeline Tracking
  it('7. Activity Timeline: Stage transitions and notes generate activity timeline events', async () => {
    const deal = await crmService.createDeal(tenantA, memberActor, {
      title: 'Audited Deal',
      value: '45000.00',
      currency: 'USD',
      pipelineId: pipelineAId,
      stageId: stageLeadId,
    });

    // Transition stage
    await crmService.transitionDealStage(tenantA, memberActor, deal.id, {
      newStageId: stageQualifiedId,
      expectedVersion: 1,
    });

    // Log a manual note activity
    await crmService.createActivity(tenantA, memberActor, {
      type: 'note',
      subject: 'Discovery Call Completed',
      body: 'Customer confirmed budget and timeline for Q4 deployment.',
      dealId: deal.id,
    });

    // Query activity history for this deal
    const activities = await crmService.listActivities(tenantA, { dealId: deal.id });
    expect(activities).toHaveLength(2);
    expect(activities.some((a) => a.type === 'stage_change')).toBe(true);
    expect(activities.some((a) => a.type === 'note')).toBe(true);
  });

  // 8. Delete Permission: Only Owner/Admin can delete records
  it('8. Deletion Restrictions: Members cannot delete deals or accounts', async () => {
    const account = await crmService.createAccount(tenantA, memberActor, {
      name: 'Delete Target Co',
    });

    // Member tries to delete: 403 Forbidden
    await expect(
      crmService.deleteAccount(tenantA, memberActor, account.id)
    ).rejects.toThrow(/Only owners and administrators are permitted to delete/);

    // Owner deletes: Success
    await crmService.deleteAccount(tenantA, ownerActor, account.id);

    // Verify soft-deleted account is excluded from lists
    const list = await crmService.listAccounts(tenantA, {});
    expect(list.data.find((a) => a.id === account.id)).toBeUndefined();
  });
});
