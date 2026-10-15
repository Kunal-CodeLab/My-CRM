import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { TeamService } from '../../src/team/team.service';
import { AuthService } from '../../src/auth/auth.service';
import { TokenService } from '../../src/auth/token-service';
import { createTestDatabase } from '../phase0/pglite-runner';
import { TenantContext } from '@crm/shared-types';
import { ForbiddenException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Team & Organization Membership Administration Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let teamService: TeamService;
  let authService: AuthService;
  let tokenService: TokenService;

  let tenantAId: string;
  let tenantBId: string;

  let ownerAId: string;
  let adminAId: string;
  let memberAId: string;
  let readOnlyAId: string;
  let memberBId: string;

  let ownerAContext: TenantContext;
  let adminAContext: TenantContext;
  let memberAContext: TenantContext;
  let readOnlyAContext: TenantContext;
  let memberBContext: TenantContext;

  beforeEach(async () => {
    db = await createTestDatabase();
    teamService = new TeamService(db as any);
    tokenService = new TokenService();
    authService = new AuthService(db as any, tokenService);

    // Seed Organizations
    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Acme Global', 'acme-global'),
              ($2, 'Nexus Corp', 'nexus-corp')`,
      [tenantAId, tenantBId],
    );

    // Seed Users
    ownerAId = crypto.randomUUID();
    adminAId = crypto.randomUUID();
    memberAId = crypto.randomUUID();
    readOnlyAId = crypto.randomUUID();
    memberBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.users (id, email, password_hash, first_name, last_name)
       VALUES ($1, 'owner@acme.com', 'argon2_hash', 'Olivia', 'Owner'),
              ($2, 'admin@acme.com', 'argon2_hash', 'Adam', 'Admin'),
              ($3, 'rep@acme.com', 'argon2_hash', 'Rachel', 'Rep'),
              ($4, 'auditor@acme.com', 'argon2_hash', 'Arthur', 'Auditor'),
              ($5, 'member@nexus.com', 'argon2_hash', 'Nathan', 'Nexus')`,
      [ownerAId, adminAId, memberAId, readOnlyAId, memberBId],
    );

    // Seed Memberships
    await db.query(
      `INSERT INTO public.memberships (id, tenant_id, user_id, role, status, session_version)
       VALUES ($1, $2, $3, 'owner', 'active', 1),
              ($4, $5, $6, 'admin', 'active', 1),
              ($7, $8, $9, 'member', 'active', 1),
              ($10, $11, $12, 'read_only', 'active', 1),
              ($13, $14, $15, 'member', 'active', 1)`,
      [
        crypto.randomUUID(), tenantAId, ownerAId,
        crypto.randomUUID(), tenantAId, adminAId,
        crypto.randomUUID(), tenantAId, memberAId,
        crypto.randomUUID(), tenantAId, readOnlyAId,
        crypto.randomUUID(), tenantBId, memberBId,
      ],
    );

    ownerAContext = {
      userId: ownerAId,
      email: 'owner@acme.com',
      tenantId: tenantAId,
      role: 'owner',
      permissions: ['*'],
    };

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

    memberBContext = {
      userId: memberBId,
      email: 'member@nexus.com',
      tenantId: tenantBId,
      role: 'member',
      permissions: ['read', 'write'],
    };
  });

  // =========================================================================
  // 1. LIST MEMBERS & TENANT ISOLATION
  // =========================================================================
  describe('Member Directory & Tenant Isolation', () => {
    it('lists all active members within the active tenant with user profiles and roles', async () => {
      const members = await teamService.listMembers(tenantAId, memberAContext, db);

      expect(members.length).toBe(4);
      expect(members.map((m) => m.role).sort()).toEqual(['admin', 'member', 'owner', 'read_only'].sort());
      expect(members.find((m) => m.email === 'owner@acme.com')?.role).toBe('owner');
      expect(members.find((m) => m.email === 'rep@acme.com')?.firstName).toBe('Rachel');
    });

    it('enforces tenant isolation: Tenant A cannot see Tenant B members', async () => {
      const membersA = await teamService.listMembers(tenantAId, memberAContext, db);
      expect(membersA.some((m) => m.email === 'member@nexus.com')).toBe(false);

      const membersB = await teamService.listMembers(tenantBId, memberBContext, db);
      expect(membersB.length).toBe(1);
      expect(membersB[0].email).toBe('member@nexus.com');
    });
  });

  // =========================================================================
  // 2. INVITATIONS & RBAC
  // =========================================================================
  describe('Team Invitations & Access Control', () => {
    it('allows Admin to issue a secure token invitation to a new representative', async () => {
      const invite = await teamService.createInvitation(
        tenantAId,
        adminAContext,
        { email: 'newhire@acme.com', role: 'member' },
        db,
      );

      expect(invite.email).toBe('newhire@acme.com');
      expect(invite.role).toBe('member');
      expect(invite.status).toBe('pending');
      expect(invite.invitationToken).toBeDefined();
      expect(invite.invitationToken!.length).toBe(64); // 32 bytes hex

      const expiry = new Date(invite.expiresAt).getTime();
      expect(expiry).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000); // 7 days ahead
    });

    it('enforces RBAC: Member and Read-Only users are forbidden from inviting members', async () => {
      await expect(
        teamService.createInvitation(
          tenantAId,
          memberAContext,
          { email: 'intruder@acme.com', role: 'member' },
          db,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        teamService.createInvitation(
          tenantAId,
          readOnlyAContext,
          { email: 'intruder@acme.com', role: 'member' },
          db,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invitation if user is already an active member of this organization', async () => {
      await expect(
        teamService.createInvitation(
          tenantAId,
          adminAContext,
          { email: 'rep@acme.com', role: 'member' },
          db,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('lists pending invitations and allows Admin to cancel an invitation', async () => {
      const invite = await teamService.createInvitation(
        tenantAId,
        adminAContext,
        { email: 'contractor@acme.com', role: 'read_only' },
        db,
      );

      const listBefore = await teamService.listInvitations(tenantAId, adminAContext, db);
      expect(listBefore.some((i) => i.id === invite.id)).toBe(true);

      const cancelResult = await teamService.cancelInvitation(tenantAId, adminAContext, invite.id, db);
      expect(cancelResult.success).toBe(true);

      const listAfter = await teamService.listInvitations(tenantAId, adminAContext, db);
      expect(listAfter.some((i) => i.id === invite.id)).toBe(false);
    });

    it('allows invited user to accept invitation and activates new membership', async () => {
      const invite = await teamService.createInvitation(
        tenantAId,
        adminAContext,
        { email: 'charlie@acme.com', role: 'member' },
        db,
      );

      // Invited user accepts
      const acceptResult = await authService.acceptInvitation({
        invitationToken: invite.invitationToken!,
        password: 'SecurePassword123!',
        firstName: 'Charlie',
        lastName: 'Cooper',
      });

      expect(acceptResult.tenantId).toBe(tenantAId);
      expect(acceptResult.userId).toBeDefined();

      // Verify active membership exists
      const members = await teamService.listMembers(tenantAId, adminAContext, db);
      const newMember = members.find((m) => m.email === 'charlie@acme.com');
      expect(newMember).toBeDefined();
      expect(newMember?.role).toBe('member');
      expect(newMember?.status).toBe('active');
    });
  });

  // =========================================================================
  // 3. ROLE MODIFICATION & ACCESS REVOCATION
  // =========================================================================
  describe('Role Modification & Member Revocation', () => {
    it('allows Admin to update member role and increments session_version', async () => {
      const membersBefore = await teamService.listMembers(tenantAId, adminAContext, db);
      const rep = membersBefore.find((m) => m.email === 'rep@acme.com')!;
      expect(rep.sessionVersion).toBe(1);

      const updated = await teamService.updateMemberRole(
        tenantAId,
        adminAContext,
        rep.id,
        { role: 'admin' },
        db,
      );

      expect(updated.role).toBe('admin');
      expect(updated.sessionVersion).toBe(2);
    });

    it('forbids non-owner admin from altering the Owner role', async () => {
      const members = await teamService.listMembers(tenantAId, adminAContext, db);
      const ownerMem = members.find((m) => m.email === 'owner@acme.com')!;

      await expect(
        teamService.updateMemberRole(
          tenantAId,
          adminAContext,
          ownerMem.id,
          { role: 'member' },
          db,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin to revoke member access, preventing self-revocation and owner revocation', async () => {
      const members = await teamService.listMembers(tenantAId, adminAContext, db);
      const rep = members.find((m) => m.email === 'rep@acme.com')!;
      const adminMem = members.find((m) => m.email === 'admin@acme.com')!;
      const ownerMem = members.find((m) => m.email === 'owner@acme.com')!;

      // 1. Cannot revoke self
      await expect(
        teamService.revokeMember(tenantAId, adminAContext, adminMem.id, db),
      ).rejects.toThrow(BadRequestException);

      // 2. Cannot revoke owner
      await expect(
        teamService.revokeMember(tenantAId, adminAContext, ownerMem.id, db),
      ).rejects.toThrow(ForbiddenException);

      // 3. Admin revokes rep: Success
      const revokeRes = await teamService.revokeMember(tenantAId, adminAContext, rep.id, db);
      expect(revokeRes.success).toBe(true);

      // Active members list no longer contains revoked rep
      const membersAfter = await teamService.listMembers(tenantAId, adminAContext, db);
      expect(membersAfter.some((m) => m.id === rep.id)).toBe(false);
    });
  });
});
