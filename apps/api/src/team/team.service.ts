import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  TenantContext,
  TeamMember,
  OrganizationInvitationItem,
  CreateInvitationRequest,
  UpdateMemberRoleRequest,
  UserRole,
} from '@crm/shared-types';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaClient) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * List all team members within the active tenant
   */
  async listMembers(tenantId: string, actor: TenantContext, dbClient?: any): Promise<TeamMember[]> {
    const client = dbClient || this.prisma;

    if (client.query) {
      // PGlite in-memory test runner
      const res = await client.query(
        `SELECT m.id, m.user_id, m.role, m.status, m.session_version, m.created_at,
                u.email, u.first_name, u.last_name
         FROM public.memberships m
         JOIN public.users u ON m.user_id = u.id
         WHERE m.tenant_id = $1 AND m.status != 'revoked'
         ORDER BY m.created_at ASC`,
        [tenantId],
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        role: r.role as UserRole,
        status: r.status,
        sessionVersion: r.session_version ?? 1,
        joinedAt: new Date(r.created_at).toISOString(),
      }));
    }

    // Prisma Client
    const memberships = await client.membership.findMany({
      where: {
        tenantId,
        status: { not: 'revoked' },
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role as UserRole,
      status: m.status,
      sessionVersion: m.sessionVersion,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Generate secure token invitation link for a team member
   */
  async createInvitation(
    tenantId: string,
    actor: TenantContext,
    dto: CreateInvitationRequest,
    dbClient?: any,
  ): Promise<OrganizationInvitationItem> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can invite team members.');
    }

    const email = dto.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }

    const role = dto.role || 'member';
    if (!['admin', 'member', 'read_only'].includes(role)) {
      throw new BadRequestException('Invalid member role specified.');
    }

    const client = dbClient || this.prisma;

    // Check if user is already an active member of the tenant
    if (client.query) {
      const existingMemberRes = await client.query(
        `SELECT m.id FROM public.memberships m
         JOIN public.users u ON m.user_id = u.id
         WHERE m.tenant_id = $1 AND LOWER(u.email) = $2 AND m.status = 'active'`,
        [tenantId, email],
      );
      if (existingMemberRes.rows.length > 0) {
        throw new ConflictException(`User ${email} is already an active member of this organization.`);
      }
    } else {
      const existingUser = await client.user.findUnique({
        where: { email },
        include: {
          memberships: {
            where: { tenantId, status: 'active' },
          },
        },
      });
      if (existingUser && existingUser.memberships.length > 0) {
        throw new ConflictException(`User ${email} is already an active member of this organization.`);
      }
    }

    // Generate secure raw invitation token and cryptographic SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity
    const invId = crypto.randomUUID();

    if (client.query) {
      // Invalidate existing pending invitations for this email in this tenant
      await client.query(
        `UPDATE public.organization_invitations
         SET status = 'cancelled'
         WHERE tenant_id = $1 AND LOWER(email) = $2 AND status = 'pending'`,
        [tenantId, email],
      );

      const insertRes = await client.query(
        `INSERT INTO public.organization_invitations (id, tenant_id, email, role, token_hash, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id, tenant_id, email, role, status, expires_at, created_at`,
        [invId, tenantId, email, role, tokenHash, expiresAt.toISOString()],
      );
      const row = insertRes.rows[0];

      return {
        id: row.id,
        tenantId: row.tenant_id,
        email: row.email,
        role: row.role as UserRole,
        status: row.status,
        expiresAt: new Date(row.expires_at).toISOString(),
        createdAt: new Date(row.created_at).toISOString(),
        invitationToken: rawToken,
      };
    }

    // Prisma
    await client.organizationInvitation.updateMany({
      where: { tenantId, email, status: 'pending' },
      data: { status: 'cancelled' },
    });

    const created = await client.organizationInvitation.create({
      data: {
        id: invId,
        tenantId,
        email,
        role,
        tokenHash,
        status: 'pending',
        expiresAt,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      email: created.email,
      role: created.role as UserRole,
      status: created.status as any,
      expiresAt: created.expiresAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      invitationToken: rawToken,
    };
  }

  /**
   * List pending invitations for active tenant
   */
  async listInvitations(tenantId: string, actor: TenantContext, dbClient?: any): Promise<OrganizationInvitationItem[]> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can view invitations.');
    }

    const client = dbClient || this.prisma;

    if (client.query) {
      const res = await client.query(
        `SELECT id, tenant_id, email, role, status, expires_at, created_at
         FROM public.organization_invitations
         WHERE tenant_id = $1 AND status = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [tenantId],
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        email: r.email,
        role: r.role as UserRole,
        status: r.status,
        expiresAt: new Date(r.expires_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }

    const invitations = await client.organizationInvitation.findMany({
      where: {
        tenantId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv: any) => ({
      id: inv.id,
      tenantId: inv.tenantId,
      email: inv.email,
      role: inv.role as UserRole,
      status: inv.status as any,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  /**
   * Cancel / revoke an unaccepted invitation
   */
  async cancelInvitation(tenantId: string, actor: TenantContext, invitationId: string, dbClient?: any): Promise<{ success: boolean }> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can cancel invitations.');
    }

    const client = dbClient || this.prisma;

    if (client.query) {
      const res = await client.query(
        `UPDATE public.organization_invitations
         SET status = 'cancelled'
         WHERE id = $1 AND tenant_id = $2
         RETURNING id`,
        [invitationId, tenantId],
      );
      if (res.rows.length === 0) {
        throw new NotFoundException('Invitation not found.');
      }
      return { success: true };
    }

    const existing = await client.organizationInvitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Invitation not found.');
    }

    await client.organizationInvitation.update({
      where: { id: existing.id },
      data: { status: 'cancelled' },
    });

    return { success: true };
  }

  /**
   * Update team member role with sessionVersion increment
   */
  async updateMemberRole(
    tenantId: string,
    actor: TenantContext,
    membershipId: string,
    dto: UpdateMemberRoleRequest,
    dbClient?: any,
  ): Promise<TeamMember> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can modify member roles.');
    }

    const newRole = dto.role;
    if (!['admin', 'member', 'read_only'].includes(newRole)) {
      throw new BadRequestException('Invalid target role.');
    }

    const client = dbClient || this.prisma;

    if (client.query) {
      const memRes = await client.query(
        `SELECT m.id, m.user_id, m.role, m.status, m.session_version, m.created_at,
                u.email, u.first_name, u.last_name
         FROM public.memberships m
         JOIN public.users u ON m.user_id = u.id
         WHERE m.id = $1 AND m.tenant_id = $2 AND m.status = 'active'`,
        [membershipId, tenantId],
      );
      if (memRes.rows.length === 0) {
        throw new NotFoundException('Active membership not found within this organization.');
      }
      const current = memRes.rows[0];

      if (current.role === 'owner' && actor.role !== 'owner') {
        throw new ForbiddenException('Only the organization owner can modify the owner membership.');
      }

      const updateRes = await client.query(
        `UPDATE public.memberships
         SET role = $1, session_version = session_version + 1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3
         RETURNING id, user_id, role, status, session_version, created_at`,
        [newRole, membershipId, tenantId],
      );
      const updated = updateRes.rows[0];

      return {
        id: updated.id,
        userId: updated.user_id,
        email: current.email,
        firstName: current.first_name,
        lastName: current.last_name,
        role: updated.role as UserRole,
        status: updated.status,
        sessionVersion: updated.session_version,
        joinedAt: new Date(updated.created_at).toISOString(),
      };
    }

    const membership = await client.membership.findFirst({
      where: { id: membershipId, tenantId, status: 'active' },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException('Active membership not found within this organization.');
    }

    if (membership.role === 'owner' && actor.role !== 'owner') {
      throw new ForbiddenException('Only the organization owner can modify the owner membership.');
    }

    const updated = await client.membership.update({
      where: { id: membership.id },
      data: {
        role: newRole,
        sessionVersion: { increment: 1 },
      },
      include: { user: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      firstName: updated.user.firstName,
      lastName: updated.user.lastName,
      role: updated.role as UserRole,
      status: updated.status,
      sessionVersion: updated.sessionVersion,
      joinedAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Revoke member access
   */
  async revokeMember(
    tenantId: string,
    actor: TenantContext,
    membershipId: string,
    dbClient?: any,
  ): Promise<{ success: boolean }> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can revoke team members.');
    }

    const client = dbClient || this.prisma;

    if (client.query) {
      const memRes = await client.query(
        `SELECT id, user_id, role FROM public.memberships
         WHERE id = $1 AND tenant_id = $2`,
        [membershipId, tenantId],
      );
      if (memRes.rows.length === 0) {
        throw new NotFoundException('Membership not found.');
      }
      const target = memRes.rows[0];

      if (target.user_id === actor.userId) {
        throw new BadRequestException('You cannot revoke your own membership.');
      }
      if (target.role === 'owner') {
        throw new ForbiddenException('Organization owner membership cannot be revoked.');
      }

      await client.query(
        `UPDATE public.memberships
         SET status = 'revoked', session_version = session_version + 1, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [membershipId, tenantId],
      );

      return { success: true };
    }

    const membership = await client.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    if (membership.userId === actor.userId) {
      throw new BadRequestException('You cannot revoke your own membership.');
    }
    if (membership.role === 'owner') {
      throw new ForbiddenException('Organization owner membership cannot be revoked.');
    }

    await client.membership.update({
      where: { id: membership.id },
      data: {
        status: 'revoked',
        sessionVersion: { increment: 1 },
      },
    });

    return { success: true };
  }
}
