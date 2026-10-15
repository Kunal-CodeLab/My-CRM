import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { PasswordHasher } from '../../src/auth/password-hasher';
import { TokenService, StaleTokenException, RevokedFamilyException } from '../../src/auth/token-service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../../src/auth/guards/tenant-membership.guard';
import { AuthService } from '../../src/auth/auth.service';
import { createTestDatabase } from '../phase0/pglite-runner';

// Lightweight PGlite-backed Prisma Client wrapper for real PostgreSQL 16 testing
function createPglitePrisma(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  return {
    user: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.users (id, email, password_hash, first_name, last_name, is_superadmin)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [id, data.email, data.passwordHash, data.firstName, data.lastName, data.isSuperadmin || false]
        );
        return formatUser(res.rows[0]);
      },
      async findUnique({ where, include }: any) {
        let res;
        if (where.email) {
          res = await db.query(`SELECT * FROM public.users WHERE email = $1`, [where.email]);
        } else if (where.id) {
          res = await db.query(`SELECT * FROM public.users WHERE id = $1`, [where.id]);
        }
        if (!res || res.rows.length === 0) return null;
        const user = formatUser(res.rows[0]);
        if (include?.memberships) {
          const mRes = await db.query(
            `SELECT m.*, o.name as org_name, o.slug as org_slug, o.status as org_status
             FROM public.memberships m
             JOIN public.organizations o ON m.tenant_id = o.id
             WHERE m.user_id = $1 AND m.status = 'active'`,
            [user.id]
          );
          user.memberships = mRes.rows.map((m: any) => ({
            id: m.id,
            tenantId: m.tenant_id,
            userId: m.user_id,
            role: m.role,
            status: m.status,
            sessionVersion: m.session_version,
            organization: {
              id: m.tenant_id,
              name: m.org_name,
              slug: m.org_slug,
              status: m.org_status,
            },
          }));
        }
        return user;
      },
    },
    organization: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.organizations (id, name, slug, status)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, data.name, data.slug, data.status || 'active']
        );
        return formatOrg(res.rows[0]);
      },
      async findUnique({ where }: any) {
        const res = await db.query(`SELECT * FROM public.organizations WHERE slug = $1`, [where.slug]);
        return res.rows.length > 0 ? formatOrg(res.rows[0]) : null;
      },
    },
    membership: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.memberships (id, tenant_id, user_id, role, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [id, data.tenantId, data.userId, data.role, data.status || 'active']
        );
        return formatMembership(res.rows[0]);
      },
      async findFirst({ where, include }: any) {
        let query = `SELECT m.*`;
        let join = ``;
        if (include?.organization) {
          query += `, o.name as org_name, o.slug as org_slug`;
          join = ` JOIN public.organizations o ON m.tenant_id = o.id`;
        }
        query += ` FROM public.memberships m ${join} WHERE m.user_id = $1 AND m.tenant_id = $2`;
        const res = await db.query(query, [where.userId, where.tenantId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const m = formatMembership(row);
        if (include?.organization) {
          m.organization = {
            id: row.tenant_id,
            name: row.org_name,
            slug: row.org_slug,
          };
        }
        return m;
      },
      async upsert({ where, create, update }: any) {
        const existing = await db.query(
          `SELECT * FROM public.memberships WHERE tenant_id = $1 AND user_id = $2`,
          [where.tenantId_userId.tenantId, where.tenantId_userId.userId]
        );
        if (existing.rows.length > 0) {
          const res = await db.query(
            `UPDATE public.memberships SET role = $1, status = $2 WHERE id = $3 RETURNING *`,
            [update.role, update.status, existing.rows[0].id]
          );
          return formatMembership(res.rows[0]);
        } else {
          return this.create({ data: create });
        }
      },
    },
    tenantQuota: {
      async createMany({ data }: any) {
        for (const item of data) {
          await db.query(
            `INSERT INTO public.tenant_quotas (tenant_id, metric, current_count, max_limit)
             VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [item.tenantId, item.metric, item.currentCount, item.maxLimit]
          );
        }
      },
    },
    pipeline: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.pipelines (id, tenant_id, name, is_default)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, data.tenantId, data.name, data.isDefault || false]
        );
        return { id: res.rows[0].id, name: res.rows[0].name };
      },
    },
    dealStage: {
      async createMany({ data }: any) {
        for (const item of data) {
          await db.query(
            `INSERT INTO public.deal_stages (tenant_id, pipeline_id, name, display_order, probability_percentage, is_won, is_lost)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [item.tenantId, item.pipelineId, item.name, item.displayOrder, item.probabilityPercentage, item.isWon || false, item.isLost || false]
          );
        }
      },
    },
    refreshTokenFamily: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.refresh_token_families (id, user_id, is_revoked)
           VALUES ($1, $2, $3) RETURNING *`,
          [id, data.userId, data.isRevoked || false]
        );
        return formatFamily(res.rows[0]);
      },
      async update({ where, data }: any) {
        const sets: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (data.activeTokenId !== undefined) {
          sets.push(`active_token_id = $${i++}`);
          params.push(data.activeTokenId);
        }
        if (data.activeUpdatedAt !== undefined) {
          sets.push(`active_updated_at = $${i++}`);
          params.push(data.activeUpdatedAt);
        }
        if (data.isRevoked !== undefined) {
          sets.push(`is_revoked = $${i++}`);
          params.push(data.isRevoked);
        }
        params.push(where.id);
        const res = await db.query(
          `UPDATE public.refresh_token_families SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          params
        );
        return formatFamily(res.rows[0]);
      },
      async updateMany({ where, data }: any) {
        await db.query(
          `UPDATE public.refresh_token_families SET is_revoked = $1 WHERE user_id = $2`,
          [data.isRevoked, where.userId]
        );
      },
    },
    refreshToken: {
      async create({ data }: any) {
        const id = data.id || crypto.randomUUID();
        const res = await db.query(
          `INSERT INTO public.refresh_tokens (id, family_id, token_hash, expires_at)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, data.familyId, data.tokenHash, data.expiresAt]
        );
        return formatToken(res.rows[0]);
      },
      async findUnique({ where, include }: any) {
        const res = await db.query(`SELECT * FROM public.refresh_tokens WHERE token_hash = $1`, [where.tokenHash]);
        if (res.rows.length === 0) return null;
        const token = formatToken(res.rows[0]);
        if (include?.family) {
          const fRes = await db.query(`SELECT * FROM public.refresh_token_families WHERE id = $1`, [token.familyId]);
          token.family = formatFamily(fRes.rows[0]);
        }
        return token;
      },
      async findFirst({ where }: any) {
        let query = `SELECT * FROM public.refresh_tokens WHERE family_id = $1`;
        const params = [where.familyId];
        if (where.rotatedAt === null) {
          query += ` AND rotated_at IS NULL`;
        }
        const res = await db.query(query, params);
        return res.rows.length > 0 ? formatToken(res.rows[0]) : null;
      },
      async update({ where, data }: any) {
        const sets: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (data.rotatedAt !== undefined) {
          sets.push(`rotated_at = $${i++}`);
          params.push(data.rotatedAt);
        }
        if (data.successorTokenId !== undefined) {
          sets.push(`successor_token_id = $${i++}`);
          params.push(data.successorTokenId);
        }
        params.push(where.id);
        const res = await db.query(
          `UPDATE public.refresh_tokens SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          params
        );
        return formatToken(res.rows[0]);
      },
    },
    organizationInvitation: {
      async findUnique({ where }: any) {
        const res = await db.query(`SELECT * FROM public.organization_invitations WHERE token_hash = $1`, [where.tokenHash]);
        return res.rows.length > 0 ? formatInvitation(res.rows[0]) : null;
      },
      async update({ where, data }: any) {
        await db.query(
          `UPDATE public.organization_invitations SET status = $1, accepted_at = $2 WHERE id = $3`,
          [data.status, data.acceptedAt, where.id]
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

function formatUser(r: any) {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    firstName: r.first_name,
    lastName: r.last_name,
    isSuperadmin: r.is_superadmin,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function formatOrg(r: any) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
  };
}

function formatMembership(r: any) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    role: r.role,
    status: r.status,
    sessionVersion: r.session_version,
  };
}

function formatFamily(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    isRevoked: r.is_revoked,
    activeTokenId: r.active_token_id,
    activeUpdatedAt: r.active_updated_at ? new Date(r.active_updated_at) : null,
  };
}

function formatToken(r: any) {
  return {
    id: r.id,
    familyId: r.family_id,
    tokenHash: r.token_hash,
    rotatedAt: r.rotated_at ? new Date(r.rotated_at) : null,
    successorTokenId: r.successor_token_id,
    expiresAt: new Date(r.expires_at),
  };
}

function formatInvitation(r: any) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    email: r.email,
    role: r.role,
    tokenHash: r.token_hash,
    status: r.status,
    expiresAt: new Date(r.expires_at),
    acceptedAt: r.accepted_at ? new Date(r.accepted_at) : null,
  };
}

describe('Phase 1: Identity, Authentication & Cross-Tab Concurrency Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: any;
  let tokenService: TokenService;
  let authService: AuthService;

  beforeEach(async () => {
    db = await createTestDatabase();
    prisma = createPglitePrisma(db);
    tokenService = new TokenService('phase1_super_secure_jwt_testing_secret_key_32_bytes');
    authService = new AuthService(prisma, tokenService);
  });

  // 1. Argon2id Password Hashing & Verification
  it('1. Password Hashing: Argon2id hashes with memory cost 64MB and verifies constant-time match', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await PasswordHasher.hash(password);

    expect(hash).toContain('$argon2id$');
    expect(hash).toContain('m=65536'); // 64 MB
    expect(hash).toContain('t=3');     // 3 iterations

    const isValid = await PasswordHasher.verify(password, hash);
    expect(isValid).toBe(true);

    const isWrong = await PasswordHasher.verify('WrongPassword123!', hash);
    expect(isWrong).toBe(false);
  });

  // 2. JWT Access Token Generation, Claims & Expiration
  it('2. Access Tokens: Generates and cryptographically verifies claims and expiry', async () => {
    const claims = {
      sub: '01924b10-6bc7-7f8e-a2b1-111111111111',
      tid: '01924b10-6bc7-7f8e-a2b1-222222222222',
      role: 'owner',
      email: 'owner@acme.corp',
      sessionVersion: 1,
    };

    const token = tokenService.generateAccessToken(claims);
    expect(typeof token).toBe('string');

    const decoded = tokenService.verifyAccessToken(token);
    expect(decoded.sub).toBe(claims.sub);
    expect(decoded.tid).toBe(claims.tid);
    expect(decoded.role).toBe(claims.role);
    expect(decoded.email).toBe(claims.email);
    expect(decoded.sessionVersion).toBe(1);

    // Tampered token fails verification
    const tampered = token.slice(0, -5) + 'abcde';
    expect(() => tokenService.verifyAccessToken(tampered)).toThrow();
  });

  // 3. Protected Route Guard (JwtAuthGuard)
  it('3. JwtAuthGuard: Rejects missing or invalid schemes and populates request user on valid token', () => {
    const guard = new JwtAuthGuard(tokenService);

    // Missing header
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as any)
    ).toThrow(/Authorization header is missing/);

    // Invalid scheme (Basic instead of Bearer)
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Basic 12345' } }),
        }),
      } as any)
    ).toThrow(/Bearer scheme/);

    // Valid Bearer
    const token = tokenService.generateAccessToken({
      sub: '01924b10-6bc7-7f8e-a2b1-111111111111',
      tid: '01924b10-6bc7-7f8e-a2b1-222222222222',
      role: 'admin',
      email: 'admin@acme.corp',
      sessionVersion: 1,
    });

    const validReq: any = { headers: { authorization: `Bearer ${token}` } };
    const canActivate = guard.canActivate({
      switchToHttp: () => ({ getRequest: () => validReq }),
    } as any);

    expect(canActivate).toBe(true);
    expect(validReq.user.sub).toBe('01924b10-6bc7-7f8e-a2b1-111111111111');
  });

  // 4. Pre-GUC Membership Guard (TenantMembershipGuard - Suite 3)
  it('4. TenantMembershipGuard: Rejects foreign tenant access with 403 Forbidden before GUC checkout', async () => {
    const guard = new TenantMembershipGuard(prisma);

    const userId = '01924b10-6bc7-7f8e-a2b1-111111111111';
    const tenantA = '01924b10-6bc7-7f8e-a2b1-aaaaaaaaaaaa';
    const tenantB = '01924b10-6bc7-7f8e-a2b1-bbbbbbbbbbbb';

    // Provision User and Org A & B
    await prisma.user.create({
      data: { id: userId, email: 'user@test.corp', passwordHash: 'hash', firstName: 'U', lastName: 'T' },
    });
    await prisma.organization.create({ data: { id: tenantA, name: 'Org A', slug: 'org-a' } });
    await prisma.organization.create({ data: { id: tenantB, name: 'Org B', slug: 'org-b' } });

    // User is ONLY member of Tenant A
    await prisma.membership.create({
      data: { tenantId: tenantA, userId, role: 'member', status: 'active' },
    });

    // Request specifying Tenant A: Allowed
    const allowedReq: any = { user: { sub: userId, tid: tenantA, role: 'member', email: 'user@test.corp', sessionVersion: 1 } };
    const allowed = await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => allowedReq }),
    } as any);
    expect(allowed).toBe(true);
    // Regression check: verify request.tenant is hydrated
    expect(allowedReq.tenant).toBeDefined();
    expect(allowedReq.tenant.tenantId).toBe(tenantA);
    expect(allowedReq.tenant.userId).toBe(userId);
    expect(allowedReq.tenant.role).toBe('member');

    // Regression check: session version mismatch immediately rejects with 401
    await db.query(`UPDATE public.memberships SET session_version = 2 WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantA]);
    const staleSessionReq: any = { user: { sub: userId, tid: tenantA, role: 'member', sessionVersion: 1 } };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => staleSessionReq }),
      } as any)
    ).rejects.toThrow(/Session has been revoked/);

    // Regression check: revoked membership immediately rejects with 403
    await db.query(`UPDATE public.memberships SET status = 'revoked', session_version = 3 WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantA]);
    const revokedReq: any = { user: { sub: userId, tid: tenantA, role: 'member', sessionVersion: 3 } };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => revokedReq }),
      } as any)
    ).rejects.toThrow(/is revoked/);

    // Request specifying Tenant B: Rejected with 403 Forbidden (Pre-GUC check)
    const foreignReq: any = { user: { sub: userId, tid: tenantB, role: 'member', sessionVersion: 1 } };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => foreignReq }),
      } as any)
    ).rejects.toThrow(/not a member of organization/);
  });

  // 5. Refresh Token Rotation & Lineage Tracking (Suite 5: Single-Flight)
  it('5. Refresh Token Rotation: Rotates active token and links successor without branching', async () => {
    const userId = '01924b10-6bc7-7f8e-a2b1-111111111111';
    await prisma.user.create({
      data: { id: userId, email: 'user@tokens.com', passwordHash: 'hash', firstName: 'T', lastName: 'U' },
    });

    // Issue initial token family R1
    const { familyId, rawRefreshToken: r1 } = await tokenService.createTokenFamily(prisma, userId);

    // Rotate R1 -> R2
    const rotation1 = await tokenService.rotateRefreshToken(prisma, r1);
    expect(rotation1.isRecovery).toBe(false);
    expect(rotation1.familyId).toBe(familyId);
    expect(rotation1.rawRefreshToken).not.toBe(r1);

    const r2 = rotation1.rawRefreshToken;

    // Verify R1 is marked rotated in PostgreSQL 16
    const r1Hash = tokenService.hashToken(r1);
    const r1Record = await prisma.refreshToken.findUnique({ where: { tokenHash: r1Hash } });
    expect(r1Record.rotatedAt).not.toBeNull();
    expect(r1Record.successorTokenId).toBe(rotation1.activeTokenId);

    // Rotate R2 -> R3
    const rotation2 = await tokenService.rotateRefreshToken(prisma, r2);
    expect(rotation2.isRecovery).toBe(false);
    expect(rotation2.rawRefreshToken).not.toBe(r2);
  });

  // 6. Concurrent Tabs Recovery Window (Suite 5: 30s Bounded Convergence)
  it('6. Concurrency Recovery: Two concurrent tabs submitting R1 within 30s converge to active token', async () => {
    const userId = '01924b10-6bc7-7f8e-a2b1-111111111111';
    await prisma.user.create({
      data: { id: userId, email: 'tabs@concurrency.com', passwordHash: 'hash', firstName: 'C', lastName: 'T' },
    });

    // Issue initial token R1
    const { rawRefreshToken: r1 } = await tokenService.createTokenFamily(prisma, userId);

    // Tab 1 executes refresh first: R1 -> R2
    const tab1Result = await tokenService.rotateRefreshToken(prisma, r1);
    expect(tab1Result.isRecovery).toBe(false);

    // Tab 2 (concurrent tab holding R1) executes refresh 200ms later:
    // Falls within 30-second recovery window -> returns active recovery token without creating R3
    const tab2Result = await tokenService.rotateRefreshToken(prisma, r1);
    expect(tab2Result.isRecovery).toBe(true);
    expect(tab2Result.activeTokenId).toBe(tab1Result.activeTokenId);
  });

  // 7. Stale Token Replay Outside 30s Recovery Window (Suite 5: Expired Replay)
  it('7. Stale Token Rejection: Submitting rotated token outside 30s window rejects with ERR_STALE_TOKEN without revoking family', async () => {
    const userId = '01924b10-6bc7-7f8e-a2b1-111111111111';
    await prisma.user.create({
      data: { id: userId, email: 'stale@replay.com', passwordHash: 'hash', firstName: 'S', lastName: 'R' },
    });

    const { familyId, rawRefreshToken: r1 } = await tokenService.createTokenFamily(prisma, userId);

    // Rotate R1
    await tokenService.rotateRefreshToken(prisma, r1);

    // Simulate clock passage: artificially set R1 rotatedAt to 45 seconds ago
    const r1Hash = tokenService.hashToken(r1);
    const fortyFiveSecsAgo = new Date(Date.now() - 45 * 1000);
    await db.query(`UPDATE public.refresh_tokens SET rotated_at = $1 WHERE token_hash = $2`, [fortyFiveSecsAgo, r1Hash]);

    // Submitting R1 now must throw StaleTokenException
    await expect(tokenService.rotateRefreshToken(prisma, r1)).rejects.toThrow(StaleTokenException);

    // Family must NOT be revoked purely due to delay
    const family = await db.query(`SELECT is_revoked FROM public.refresh_token_families WHERE id = $1`, [familyId]);
    expect(family.rows[0].is_revoked).toBe(false);
  });

  // 8. Logout & Session Revocation
  it('8. Session Revocation: Logout revokes token family and subsequent refreshes fail with ERR_TOKEN_FAMILY_REVOKED', async () => {
    const userId = '01924b10-6bc7-7f8e-a2b1-111111111111';
    await prisma.user.create({
      data: { id: userId, email: 'logout@session.com', passwordHash: 'hash', firstName: 'L', lastName: 'O' },
    });

    const { rawRefreshToken } = await tokenService.createTokenFamily(prisma, userId);

    // Execute logout
    await authService.logout(rawRefreshToken);

    // Attempt refresh on revoked family: Throws RevokedFamilyException
    await expect(tokenService.rotateRefreshToken(prisma, rawRefreshToken)).rejects.toThrow(RevokedFamilyException);
  });

  // 9. Full Registration, Login & Generic Credential Defense
  it('9. Auth Flow: Registration provisions tenant domain and login defends against user enumeration', async () => {
    // Registration
    const regResult = await authService.register({
      email: 'founder@newcorp.io',
      password: 'StrongPassword123!',
      firstName: 'Jane',
      lastName: 'Doe',
      organizationName: 'New Corp',
      organizationSlug: 'new-corp',
    });

    expect(regResult.response.accessToken).toBeDefined();
    expect(regResult.response.organization.slug).toBe('new-corp');
    expect(regResult.response.organization.role).toBe('owner');

    // Valid Login
    const loginResult = await authService.login({
      email: 'founder@newcorp.io',
      password: 'StrongPassword123!',
    });
    expect(loginResult.response.accessToken).toBeDefined();
    expect(loginResult.response.user.email).toBe('founder@newcorp.io');

    // Invalid Password: Generic 401
    await expect(
      authService.login({ email: 'founder@newcorp.io', password: 'WrongPassword999!' })
    ).rejects.toThrow(/Invalid email or password/);

    // Unknown Email: Generic 401
    await expect(
      authService.login({ email: 'nonexistent@nowhere.com', password: 'Password123!' })
    ).rejects.toThrow(/Invalid email or password/);
  });

  // 10. Organization Switching
  it('10. Switch Organization: Issues new scoped JWT for authorized tenant and rejects unauthorized tenant', async () => {
    const regResult = await authService.register({
      email: 'multi@org.com',
      password: 'MultiPassword123!',
      firstName: 'Multi',
      lastName: 'User',
      organizationName: 'Org One',
      organizationSlug: 'org-one',
    });

    const userId = regResult.response.user.id;
    const orgTwoId = '01924b10-6bc7-7f8e-a2b1-222222222222';
    const unauthorizedOrgId = '01924b10-6bc7-7f8e-a2b1-999999999999';

    // Provision Org Two and grant membership to user
    await prisma.organization.create({ data: { id: orgTwoId, name: 'Org Two', slug: 'org-two' } });
    await prisma.membership.create({ data: { tenantId: orgTwoId, userId, role: 'admin', status: 'active' } });

    // Switch to Org Two: Success
    const switched = await authService.switchOrganization(userId, orgTwoId);
    expect(switched.organization.id).toBe(orgTwoId);
    expect(switched.organization.role).toBe('admin');

    const decoded = tokenService.verifyAccessToken(switched.accessToken);
    expect(decoded.tid).toBe(orgTwoId);
    expect(decoded.role).toBe('admin');

    // Attempt switch to unauthorized organization: 403 Forbidden
    await expect(authService.switchOrganization(userId, unauthorizedOrgId)).rejects.toThrow(
      /not an active member/
    );
  });
});
