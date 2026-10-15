import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * SystemDbContext operates strictly on global identity tables:
 * users, organizations, memberships, organization_invitations, refresh_tokens.
 * Prohibits accessing tenant-owned domain tables (accounts, contacts, deals).
 */
@Injectable()
export class SystemDbContext {
  constructor(private readonly prisma: PrismaClient) {}

  get user() {
    return this.prisma.user;
  }

  get organization() {
    return this.prisma.organization;
  }

  get membership() {
    return this.prisma.membership;
  }

  get invitation() {
    return this.prisma.organizationInvitation;
  }

  get refreshTokenFamily() {
    return this.prisma.refreshTokenFamily;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }
}
