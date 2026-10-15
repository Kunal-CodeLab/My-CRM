import { Injectable, UnauthorizedException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PasswordHasher } from './password-hasher';
import { TokenService, StaleTokenException, RevokedFamilyException } from './token-service';
import { RegisterDto, LoginDto, SwitchOrganizationDto, AcceptInvitationDto } from './dto/auth.dto';
import { AuthResponse, UserRole } from '@crm/shared-types';

@Injectable()
export class AuthService {
  private readonly tokenService: TokenService;

  constructor(
    private readonly prisma: PrismaClient,
    tokenService?: TokenService,
  ) {
    this.tokenService = tokenService || new TokenService();
  }

  /**
   * Two-phase atomic registration: provisions User, Organization, Owner Membership, Quotas & Pipeline
   */
  async register(dto: RegisterDto): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    // 1. Uniqueness checks
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug.toLowerCase() },
    });
    if (existingOrg) {
      throw new ConflictException('Organization slug is already in use');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await PasswordHasher.hash(dto.password);

    // 3. Atomic Provisioning
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug: dto.organizationSlug.toLowerCase(),
          status: 'active',
        },
      });

      const membership = await tx.membership.create({
        data: {
          tenantId: organization.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
        },
      });

      // Default tenant quotas
      await tx.tenantQuota.createMany({
        data: [
          { tenantId: organization.id, metric: 'active_deals', currentCount: 0, maxLimit: 100 },
          { tenantId: organization.id, metric: 'seats', currentCount: 1, maxLimit: 5 },
        ],
      });

      // Default pipeline and deal stages
      const pipeline = await tx.pipeline.create({
        data: {
          tenantId: organization.id,
          name: 'Sales Pipeline',
          isDefault: true,
        },
      });

      await tx.dealStage.createMany({
        data: [
          { tenantId: organization.id, pipelineId: pipeline.id, name: 'Lead', displayOrder: 1, probabilityPercentage: 10 },
          { tenantId: organization.id, pipelineId: pipeline.id, name: 'Qualified', displayOrder: 2, probabilityPercentage: 30 },
          { tenantId: organization.id, pipelineId: pipeline.id, name: 'Negotiation', displayOrder: 3, probabilityPercentage: 70 },
          { tenantId: organization.id, pipelineId: pipeline.id, name: 'Closed Won', displayOrder: 4, probabilityPercentage: 100, isWon: true },
          { tenantId: organization.id, pipelineId: pipeline.id, name: 'Closed Lost', displayOrder: 5, probabilityPercentage: 0, isLost: true },
        ],
      });

      return { user, organization, membership };
    });

    // 4. Token family & session generation
    const { rawRefreshToken } = await this.tokenService.createTokenFamily(this.prisma, result.user.id);

    const accessToken = this.tokenService.generateAccessToken({
      sub: result.user.id,
      tid: result.organization.id,
      role: result.membership.role,
      email: result.user.email,
      sessionVersion: result.membership.sessionVersion,
    });

    return {
      response: {
        accessToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
          role: result.membership.role as UserRole,
        },
        availableOrganizations: [
          {
            id: result.organization.id,
            name: result.organization.name,
            slug: result.organization.slug,
            role: result.membership.role as UserRole,
          },
        ],
      },
      rawRefreshToken,
    };
  }

  /**
   * User login with generic error message to prevent enumeration and constant-time password verification
   */
  async login(dto: LoginDto): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          where: { status: 'active' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      // Execute dummy verify to protect against timing attacks
      await PasswordHasher.verify(dto.password, '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHRzb21lc2FsdA$dummyhashfortimingprotection123');
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await PasswordHasher.verify(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.memberships || user.memberships.length === 0) {
      throw new ForbiddenException('User has no active organization memberships');
    }

    // Select active organization
    let activeMembership = user.memberships[0];
    if (dto.tenantId) {
      const selected = user.memberships.find((m) => m.tenantId === dto.tenantId);
      if (!selected) {
        throw new ForbiddenException('User is not an active member of the requested organization');
      }
      activeMembership = selected;
    }

    // Create session family & tokens
    const { rawRefreshToken } = await this.tokenService.createTokenFamily(this.prisma, user.id);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      tid: activeMembership.tenantId,
      role: activeMembership.role,
      email: user.email,
      sessionVersion: activeMembership.sessionVersion,
    });

    const availableOrganizations = user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role as UserRole,
    }));

    return {
      response: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        organization: {
          id: activeMembership.organization.id,
          name: activeMembership.organization.name,
          slug: activeMembership.organization.slug,
          role: activeMembership.role as UserRole,
        },
        availableOrganizations,
      },
      rawRefreshToken,
    };
  }

  /**
   * Bounded 30-Second Refresh Token Rotation
   */
  async refresh(rawToken: string): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    try {
      const rotation = await this.tokenService.rotateRefreshToken(this.prisma, rawToken);

      // Verify active user and memberships
      const user = await this.prisma.user.findUnique({
        where: { id: rotation.userId },
        include: {
          memberships: {
            where: { status: 'active' },
            include: { organization: true },
          },
        },
      });

      if (!user || user.memberships.length === 0) {
        throw new UnauthorizedException('User account or membership is no longer active');
      }

      const activeMembership = user.memberships[0];

      const accessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        tid: activeMembership.tenantId,
        role: activeMembership.role,
        email: user.email,
        sessionVersion: activeMembership.sessionVersion,
      });

      const availableOrganizations = user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role as UserRole,
      }));

      return {
        response: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          organization: {
            id: activeMembership.organization.id,
            name: activeMembership.organization.name,
            slug: activeMembership.organization.slug,
            role: activeMembership.role as UserRole,
          },
          availableOrganizations,
        },
        rawRefreshToken: rotation.rawRefreshToken,
      };
    } catch (err: any) {
      if (err instanceof StaleTokenException) {
        throw new UnauthorizedException('ERR_STALE_TOKEN: Refresh token expired outside recovery window');
      }
      if (err instanceof RevokedFamilyException) {
        throw new UnauthorizedException('ERR_TOKEN_FAMILY_REVOKED: Session family has been revoked');
      }
      throw new UnauthorizedException(err.message || 'Invalid refresh token');
    }
  }

  /**
   * Organization Switching: issues a new scoped JWT for target tenant after verifying active membership
   */
  async switchOrganization(userId: string, targetTenantId: string): Promise<{ accessToken: string; organization: AuthResponse['organization'] }> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId: targetTenantId,
        status: 'active',
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new ForbiddenException('User is not an active member of the target organization');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      tid: membership.tenantId,
      role: membership.role,
      email: user.email,
      sessionVersion: membership.sessionVersion,
    });

    return {
      accessToken,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role as UserRole,
      },
    };
  }

  /**
   * Session Logout: revokes the token family associated with the refresh token
   */
  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    try {
      const tokenHash = this.tokenService.hashToken(rawToken);
      const token = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (token) {
        await this.tokenService.revokeFamily(this.prisma, token.familyId);
      }
    } catch {
      // Safe no-op on malformed logout tokens
    }
  }

  /**
   * Claims an invitation token, creates or joins membership
   */
  async acceptInvitation(dto: AcceptInvitationDto): Promise<{ userId: string; tenantId: string }> {
    const tokenHash = this.tokenService.hashToken(dto.invitationToken);

    if ((this.prisma as any).query) {
      const client = this.prisma as any;
      const invRes = await client.query(
        `SELECT id, tenant_id, email, role, status, expires_at FROM public.organization_invitations WHERE token_hash = $1`,
        [tokenHash],
      );
      if (invRes.rows.length === 0) {
        throw new NotFoundException('Invitation not found or invalid');
      }
      const invitation = invRes.rows[0];
      if (invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date()) {
        throw new ConflictException('Invitation has expired or already been accepted');
      }

      const userRes = await client.query(
        `SELECT id, email FROM public.users WHERE LOWER(email) = $1`,
        [invitation.email.toLowerCase()],
      );
      let userId: string;
      if (userRes.rows.length === 0) {
        if (!dto.password) {
          throw new ConflictException('Password is required for new user account creation');
        }
        const passwordHash = await PasswordHasher.hash(dto.password);
        userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO public.users (id, email, password_hash, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, invitation.email.toLowerCase(), passwordHash, dto.firstName || 'Invited', dto.lastName || 'User'],
        );
      } else {
        userId = userRes.rows[0].id;
      }

      await client.query(
        `INSERT INTO public.memberships (id, tenant_id, user_id, role, status, session_version)
         VALUES ($1, $2, $3, $4, 'active', 1)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
        [crypto.randomUUID(), invitation.tenant_id, userId, invitation.role],
      );

      await client.query(
        `UPDATE public.organization_invitations
         SET status = 'accepted', accepted_at = NOW()
         WHERE id = $1`,
        [invitation.id],
      );

      return { userId, tenantId: invitation.tenant_id };
    }

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or invalid');
    }

    if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      throw new ConflictException('Invitation has expired or already been accepted');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!user) {
      if (!dto.password) {
        throw new ConflictException('Password is required for new user account creation');
      }
      const passwordHash = await PasswordHasher.hash(dto.password);
      user = await this.prisma.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName || 'Invited',
          lastName: dto.lastName || 'User',
        },
      });
    }

    // Create or reactivate membership
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId: invitation.tenantId,
            userId: user!.id,
          },
        },
        create: {
          tenantId: invitation.tenantId,
          userId: user!.id,
          role: invitation.role,
          status: 'active',
        },
        update: {
          role: invitation.role,
          status: 'active',
        },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    });

    return { userId: user.id, tenantId: invitation.tenantId };
  }

  /**
   * Retrieves active profile and available organizations for authenticated user
   */
  async getProfile(userId: string, currentTenantId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'active' },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentMembership = user.memberships.find((m) => m.tenantId === currentTenantId) || user.memberships[0];

    const availableOrganizations = user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role as UserRole,
    }));

    return {
      accessToken: '',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: currentMembership.organization.id,
        name: currentMembership.organization.name,
        slug: currentMembership.organization.slug,
        role: currentMembership.role as UserRole,
      },
      availableOrganizations,
    };
  }
}
