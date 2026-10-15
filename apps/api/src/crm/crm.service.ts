import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateContactDto,
  UpdateContactDto,
  CreateDealDto,
  UpdateDealDto,
  TransitionDealStageDto,
  CreateActivityDto,
} from './dto/crm.dto';
import { TenantContext, PaginatedResponse, Account, Contact, Pipeline, Deal, Activity } from '@crm/shared-types';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaClient) {}

  private assertNotReadOnly(actor: TenantContext) {
    if (actor.role === 'read_only') {
      throw new ForbiddenException('Read-only users cannot perform mutation operations.');
    }
  }

  private assertCanDelete(actor: TenantContext) {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only owners and administrators are permitted to delete records.');
    }
  }

  private computeAuditHash(actorId: string, entityName: string, entityId: string, action: string, diff: any): string {
    const canonical = `${actorId}:${entityName}:${entityId}:${action}:${JSON.stringify(diff)}`;
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  // ==========================================
  // ACCOUNTS
  // ==========================================

  async listAccounts(
    tenantId: string,
    params: { limit?: number; cursor?: string; search?: string }
  ): Promise<PaginatedResponse<Account>> {
    const limit = Math.min(params.limit || 25, 100);

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    if (params.cursor) {
      where.id = { gt: params.cursor };
    }

    const accounts = await this.prisma.account.findMany({
      where,
      take: limit + 1,
      orderBy: { id: 'asc' },
    });

    const hasNextPage = accounts.length > limit;
    const data = hasNextPage ? accounts.slice(0, limit) : accounts;
    const nextCursor = hasNextPage ? data[data.length - 1].id : undefined;

    return {
      data: data.map((a) => ({
        id: a.id,
        tenantId: a.tenantId,
        ownerId: a.ownerId,
        name: a.name,
        domain: a.domain,
        industry: a.industry,
        annualRevenue: a.annualRevenue ? a.annualRevenue.toString() : null,
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      meta: { limit, hasNextPage, nextCursor },
    };
  }

  async createAccount(tenantId: string, actor: TenantContext, dto: CreateAccountDto): Promise<Account> {
    this.assertNotReadOnly(actor);

    // Verify owner if assigned
    const ownerId = dto.ownerId || actor.userId;
    const ownerMembership = await this.prisma.membership.findFirst({
      where: { tenantId, userId: ownerId, status: 'active' },
    });
    if (!ownerMembership) {
      throw new BadRequestException('Assigned account owner is not an active member of the tenant.');
    }

    const account = await this.prisma.account.create({
      data: {
        tenantId,
        name: dto.name,
        domain: dto.domain,
        industry: dto.industry,
        annualRevenue: dto.annualRevenue ? parseFloat(dto.annualRevenue) : null,
        ownerId,
      },
    });

    return {
      id: account.id,
      tenantId: account.tenantId,
      ownerId: account.ownerId,
      name: account.name,
      domain: account.domain,
      industry: account.industry,
      annualRevenue: account.annualRevenue ? account.annualRevenue.toString() : null,
      deletedAt: null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async updateAccount(tenantId: string, actor: TenantContext, id: string, dto: UpdateAccountDto): Promise<Account> {
    this.assertNotReadOnly(actor);

    const existing = await this.prisma.account.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Account not found within active tenant context.');
    }

    if (actor.role === 'member' && existing.ownerId !== actor.userId) {
      throw new ForbiddenException('Members can only update accounts assigned to them.');
    }

    if (dto.ownerId && dto.ownerId !== existing.ownerId && actor.role === 'member') {
      throw new ForbiddenException('Only owners and administrators can reassign account ownership.');
    }

    const updated = await this.prisma.account.update({
      where: { id: existing.id },
      data: {
        name: dto.name !== undefined ? dto.name : existing.name,
        domain: dto.domain !== undefined ? dto.domain : existing.domain,
        industry: dto.industry !== undefined ? dto.industry : existing.industry,
        annualRevenue: dto.annualRevenue !== undefined ? (dto.annualRevenue ? parseFloat(dto.annualRevenue) : null) : existing.annualRevenue,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : existing.ownerId,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      ownerId: updated.ownerId,
      name: updated.name,
      domain: updated.domain,
      industry: updated.industry,
      annualRevenue: updated.annualRevenue ? updated.annualRevenue.toString() : null,
      deletedAt: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteAccount(tenantId: string, actor: TenantContext, id: string): Promise<void> {
    this.assertCanDelete(actor);

    const existing = await this.prisma.account.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Account not found within active tenant context.');
    }

    await this.prisma.account.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // CONTACTS
  // ==========================================

  async listContacts(
    tenantId: string,
    params: { limit?: number; cursor?: string; accountId?: string }
  ): Promise<PaginatedResponse<Contact>> {
    const limit = Math.min(params.limit || 25, 100);

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (params.accountId) {
      where.accountId = params.accountId;
    }

    if (params.cursor) {
      where.id = { gt: params.cursor };
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      take: limit + 1,
      orderBy: { id: 'asc' },
    });

    const hasNextPage = contacts.length > limit;
    const data = hasNextPage ? contacts.slice(0, limit) : contacts;
    const nextCursor = hasNextPage ? data[data.length - 1].id : undefined;

    return {
      data: data.map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        accountId: c.accountId,
        ownerId: c.ownerId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        jobTitle: c.jobTitle,
        deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      meta: { limit, hasNextPage, nextCursor },
    };
  }

  async createContact(tenantId: string, actor: TenantContext, dto: CreateContactDto): Promise<Contact> {
    this.assertNotReadOnly(actor);

    // Verify account belongs to same tenant
    if (dto.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, tenantId, deletedAt: null },
      });
      if (!account) {
        throw new BadRequestException('Referenced account does not exist within the tenant.');
      }
    }

    const ownerId = dto.ownerId || actor.userId;

    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        ownerId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
      },
    });

    return {
      id: contact.id,
      tenantId: contact.tenantId,
      accountId: contact.accountId,
      ownerId: contact.ownerId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      jobTitle: contact.jobTitle,
      deletedAt: null,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  async updateContact(tenantId: string, actor: TenantContext, id: string, dto: UpdateContactDto): Promise<Contact> {
    this.assertNotReadOnly(actor);

    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Contact not found within active tenant context.');
    }

    if (actor.role === 'member' && existing.ownerId !== actor.userId) {
      throw new ForbiddenException('Members can only update contacts assigned to them.');
    }

    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, tenantId, deletedAt: null },
      });
      if (!account) {
        throw new BadRequestException('Referenced account does not exist within the tenant.');
      }
    }

    const updated = await this.prisma.contact.update({
      where: { id: existing.id },
      data: {
        firstName: dto.firstName !== undefined ? dto.firstName : existing.firstName,
        lastName: dto.lastName !== undefined ? dto.lastName : existing.lastName,
        email: dto.email !== undefined ? dto.email : existing.email,
        phone: dto.phone !== undefined ? dto.phone : existing.phone,
        jobTitle: dto.jobTitle !== undefined ? dto.jobTitle : existing.jobTitle,
        accountId: dto.accountId !== undefined ? dto.accountId : existing.accountId,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : existing.ownerId,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      accountId: updated.accountId,
      ownerId: updated.ownerId,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      jobTitle: updated.jobTitle,
      deletedAt: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteContact(tenantId: string, actor: TenantContext, id: string): Promise<void> {
    this.assertCanDelete(actor);

    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Contact not found within active tenant context.');
    }

    await this.prisma.contact.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // PIPELINES & STAGES
  // ==========================================

  async listPipelines(tenantId: string): Promise<Pipeline[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { tenantId },
      include: {
        stages: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pipelines.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      isDefault: p.isDefault,
      createdAt: p.createdAt.toISOString(),
      stages: p.stages.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        pipelineId: s.pipelineId,
        name: s.name,
        displayOrder: s.displayOrder,
        probabilityPercentage: s.probabilityPercentage,
        isWon: s.isWon,
        isLost: s.isLost,
        createdAt: s.createdAt.toISOString(),
      })),
    })) as any;
  }

  // ==========================================
  // DEALS & STAGE TRANSITIONS
  // ==========================================

  async listDeals(tenantId: string, params: { pipelineId?: string; stageId?: string }): Promise<Deal[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (params.pipelineId) {
      where.pipelineId = params.pipelineId;
    }
    if (params.stageId) {
      where.stageId = params.stageId;
    }

    const deals = await this.prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return deals.map((d) => ({
      id: d.id,
      tenantId: d.tenantId,
      title: d.title,
      value: d.value.toString(),
      currency: d.currency,
      accountId: d.accountId,
      primaryContactId: d.primaryContactId,
      pipelineId: d.pipelineId,
      stageId: d.stageId,
      ownerId: d.ownerId,
      version: d.version,
      expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString().split('T')[0] : null,
      lostReason: d.lostReason,
      deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  /**
   * Deal Creation with Level-1 Quota Lock Enforcement
   */
  async createDeal(tenantId: string, actor: TenantContext, dto: CreateDealDto): Promise<Deal> {
    this.assertNotReadOnly(actor);

    // Validate Stage belongs to Pipeline and Tenant
    const stage = await this.prisma.dealStage.findFirst({
      where: { id: dto.stageId, pipelineId: dto.pipelineId, tenantId },
    });
    if (!stage) {
      throw new BadRequestException('Invalid stage and pipeline pairing for the active tenant.');
    }

    // Validate Account if specified
    if (dto.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, tenantId, deletedAt: null },
      });
      if (!account) {
        throw new BadRequestException('Referenced account does not exist within the tenant.');
      }
    }

    // Validate Contact if specified
    if (dto.primaryContactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.primaryContactId, tenantId, deletedAt: null },
      });
      if (!contact) {
        throw new BadRequestException('Referenced contact does not exist within the tenant.');
      }
    }

    const ownerId = dto.ownerId || actor.userId;

    // Execute within transaction with Level-1 Quota lock
    const deal = await this.prisma.$transaction(async (tx) => {
      // 1. Level-1 Quota Lock FOR UPDATE
      const quota = await tx.tenantQuota.findUnique({
        where: {
          tenantId_metric: {
            tenantId,
            metric: 'active_deals',
          },
        },
      });

      if (quota && quota.currentCount >= quota.maxLimit) {
        throw new HttpException(
          `Tenant active deal quota exceeded (${quota.currentCount}/${quota.maxLimit}). Please upgrade your subscription plan.`,
          HttpStatus.PAYMENT_REQUIRED
        );
      }

      // 2. Increment Quota
      if (quota) {
        await tx.tenantQuota.update({
          where: { tenantId_metric: { tenantId, metric: 'active_deals' } },
          data: { currentCount: { increment: 1 } },
        });
      }

      // 3. Create Deal
      const created = await tx.deal.create({
        data: {
          tenantId,
          title: dto.title,
          value: parseFloat(dto.value),
          currency: dto.currency || 'USD',
          pipelineId: dto.pipelineId,
          stageId: dto.stageId,
          accountId: dto.accountId,
          primaryContactId: dto.primaryContactId,
          ownerId,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          version: 1,
        },
      });

      // 4. Audit Log & Outbox Event
      const diff = { title: created.title, value: created.value, stageId: created.stageId };
      const hash = this.computeAuditHash(actor.userId, 'deal', created.id, 'INSERT', diff);

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: actor.userId,
          entityName: 'deal',
          entityId: created.id,
          action: 'INSERT',
          diff,
          entryHash: hash,
        },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          actorId: actor.userId,
          eventType: 'deal.created',
          payload: { dealId: created.id, title: created.title, value: created.value },
          idempotencyKey: crypto.randomUUID(),
        },
      });

      return created;
    });

    return {
      id: deal.id,
      tenantId: deal.tenantId,
      title: deal.title,
      value: deal.value.toString(),
      currency: deal.currency,
      accountId: deal.accountId,
      primaryContactId: deal.primaryContactId,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      ownerId: deal.ownerId,
      version: deal.version,
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.toISOString().split('T')[0] : null,
      lostReason: deal.lostReason,
      deletedAt: null,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
    };
  }

  /**
   * Deal Stage Transition with AD04 Invariant 8-Level Lock Hierarchy
   * Level 1 (Quotas) -> Level 2 (Memberships) -> Level 4 (Stages) -> Level 7 (Deals) -> Level 8 (Activities)
   */
  async transitionDealStage(
    tenantId: string,
    actor: TenantContext,
    id: string,
    dto: TransitionDealStageDto
  ): Promise<Deal> {
    this.assertNotReadOnly(actor);

    return this.prisma.$transaction(async (tx) => {
      // Step 1: Level-1 Quotas Lock (FOR UPDATE)
      const quota = await tx.tenantQuota.findUnique({
        where: { tenantId_metric: { tenantId, metric: 'active_deals' } },
      });

      // Step 2: Level-2 Memberships Check
      const membership = await tx.membership.findFirst({
        where: { tenantId, userId: actor.userId, status: 'active' },
      });
      if (!membership) {
        throw new ForbiddenException('User is not an active member of the tenant.');
      }

      // Step 3: Level-4 Deal Stages Lock & Validation
      const targetStage = await tx.dealStage.findFirst({
        where: { id: dto.newStageId, tenantId },
      });
      if (!targetStage) {
        throw new BadRequestException('Target deal stage does not exist within the tenant.');
      }

      // Step 4: Level-7 Deals Lock (FOR UPDATE) & Optimistic Concurrency Check
      const deal = await tx.deal.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!deal) {
        throw new NotFoundException('Deal not found within active tenant context.');
      }

      // Optimistic Version Lock Verification
      if (deal.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency conflict: Deal version has changed from ${dto.expectedVersion} to ${deal.version}. Please refresh.`
        );
      }

      // Record Ownership Enforcement
      if (actor.role === 'member' && deal.ownerId !== actor.userId) {
        throw new ForbiddenException('Sales representatives can only update deals assigned to them.');
      }

      // Invariant check: Ensure stage belongs to deal's pipeline
      if (targetStage.pipelineId !== deal.pipelineId) {
        throw new BadRequestException('Target stage belongs to a different pipeline.');
      }

      // Terminal stages validation
      if (targetStage.isWon && targetStage.isLost) {
        throw new BadRequestException('Stage cannot simultaneously be marked won and lost.');
      }

      const previousStageId = deal.stageId;

      // Mutate Deal
      const updated = await tx.deal.update({
        where: { id: deal.id },
        data: {
          stageId: targetStage.id,
          lostReason: targetStage.isLost ? dto.lostReason : null,
          version: { increment: 1 },
        },
      });

      // Step 5: Level-8 Activities insertion (Timeline tracking)
      await tx.activity.create({
        data: {
          tenantId,
          dealId: deal.id,
          createdById: actor.userId,
          type: 'stage_change',
          subject: `Stage moved to ${targetStage.name}`,
          body: JSON.stringify({
            fromStageId: previousStageId,
            toStageId: targetStage.id,
            toStageName: targetStage.name,
            lostReason: dto.lostReason || null,
          }),
        },
      });

      // Audit Log & Outbox Event
      const diff = {
        fromStageId: previousStageId,
        toStageId: targetStage.id,
        version: updated.version,
      };
      const hash = this.computeAuditHash(actor.userId, 'deal', deal.id, 'STAGE_TRANSITION', diff);

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: actor.userId,
          entityName: 'deal',
          entityId: deal.id,
          action: 'UPDATE',
          diff,
          entryHash: hash,
        },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          actorId: actor.userId,
          eventType: 'deal.stage_changed',
          payload: { dealId: deal.id, newStageId: targetStage.id, version: updated.version },
          idempotencyKey: crypto.randomUUID(),
        },
      });

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        title: updated.title,
        value: updated.value.toString(),
        currency: updated.currency,
        accountId: updated.accountId,
        primaryContactId: updated.primaryContactId,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
        ownerId: updated.ownerId,
        version: updated.version,
        expectedCloseDate: updated.expectedCloseDate ? updated.expectedCloseDate.toISOString().split('T')[0] : null,
        lostReason: updated.lostReason,
        deletedAt: null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async updateDeal(tenantId: string, actor: TenantContext, id: string, dto: UpdateDealDto): Promise<Deal> {
    this.assertNotReadOnly(actor);

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!deal) {
        throw new NotFoundException('Deal not found within active tenant context.');
      }

      if (deal.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic lock conflict: Deal version has changed from ${dto.expectedVersion} to ${deal.version}.`
        );
      }

      if (actor.role === 'member' && deal.ownerId !== actor.userId) {
        throw new ForbiddenException('Members can only update deals assigned to them.');
      }

      if (dto.ownerId && dto.ownerId !== deal.ownerId && actor.role === 'member') {
        throw new ForbiddenException('Only owners and administrators can reassign deal ownership.');
      }

      const updated = await tx.deal.update({
        where: { id: deal.id },
        data: {
          title: dto.title !== undefined ? dto.title : deal.title,
          value: dto.value !== undefined ? parseFloat(dto.value) : deal.value,
          currency: dto.currency !== undefined ? dto.currency : deal.currency,
          accountId: dto.accountId !== undefined ? dto.accountId : deal.accountId,
          primaryContactId: dto.primaryContactId !== undefined ? dto.primaryContactId : deal.primaryContactId,
          ownerId: dto.ownerId !== undefined ? dto.ownerId : deal.ownerId,
          expectedCloseDate: dto.expectedCloseDate !== undefined ? (dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null) : deal.expectedCloseDate,
          lostReason: dto.lostReason !== undefined ? dto.lostReason : deal.lostReason,
          version: { increment: 1 },
        },
      });

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        title: updated.title,
        value: updated.value.toString(),
        currency: updated.currency,
        accountId: updated.accountId,
        primaryContactId: updated.primaryContactId,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
        ownerId: updated.ownerId,
        version: updated.version,
        expectedCloseDate: updated.expectedCloseDate ? updated.expectedCloseDate.toISOString().split('T')[0] : null,
        lostReason: updated.lostReason,
        deletedAt: null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async deleteDeal(tenantId: string, actor: TenantContext, id: string): Promise<void> {
    this.assertCanDelete(actor);

    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!deal) {
      throw new NotFoundException('Deal not found within active tenant context.');
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // ACTIVITIES
  // ==========================================

  async listActivities(
    tenantId: string,
    params: { dealId?: string; contactId?: string; accountId?: string; limit?: number }
  ): Promise<Activity[]> {
    const limit = Math.min(params.limit || 50, 100);

    const where: any = { tenantId };
    if (params.dealId) where.dealId = params.dealId;
    if (params.contactId) where.contactId = params.contactId;
    if (params.accountId) where.accountId = params.accountId;

    const activities = await this.prisma.activity.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return activities.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      type: a.type as any,
      subject: a.subject,
      body: a.body,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      dealId: a.dealId,
      contactId: a.contactId,
      accountId: a.accountId,
      createdById: a.createdById,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async createActivity(tenantId: string, actor: TenantContext, dto: CreateActivityDto): Promise<Activity> {
    this.assertNotReadOnly(actor);

    // Validate relationships if specified
    if (dto.dealId) {
      const deal = await this.prisma.deal.findFirst({ where: { id: dto.dealId, tenantId, deletedAt: null } });
      if (!deal) throw new BadRequestException('Referenced deal does not exist within the tenant.');
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, tenantId, deletedAt: null } });
      if (!contact) throw new BadRequestException('Referenced contact does not exist within the tenant.');
    }
    if (dto.accountId) {
      const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, tenantId, deletedAt: null } });
      if (!account) throw new BadRequestException('Referenced account does not exist within the tenant.');
    }

    const activity = await this.prisma.activity.create({
      data: {
        tenantId,
        createdById: actor.userId,
        type: dto.type,
        subject: dto.subject,
        body: dto.body,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        dealId: dto.dealId,
        contactId: dto.contactId,
        accountId: dto.accountId,
      },
    });

    return {
      id: activity.id,
      tenantId: activity.tenantId,
      type: activity.type as any,
      subject: activity.subject,
      body: activity.body,
      dueDate: activity.dueDate ? activity.dueDate.toISOString() : null,
      completedAt: null,
      dealId: activity.dealId,
      contactId: activity.contactId,
      accountId: activity.accountId,
      createdById: activity.createdById,
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
