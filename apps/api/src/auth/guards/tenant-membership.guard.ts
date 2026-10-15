import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Pre-GUC Database Membership Verification:
   * Guarantees that un-authenticated or non-member requests are rejected with 403 Forbidden
   * before acquiring tenant connection or executing SET LOCAL app.current_tenant_id.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.sub || !user.tid) {
      throw new UnauthorizedException('Authentication claims missing tenant context');
    }

    // Direct database membership verification
    let membership: any;
    if ((this.prisma as any).query) {
      const res = await (this.prisma as any).query(
        `SELECT id, tenant_id, user_id, role, status, session_version FROM public.memberships WHERE user_id = $1 AND tenant_id = $2`,
        [user.sub, user.tid],
      );
      membership = res.rows[0] ? {
        id: res.rows[0].id,
        tenantId: res.rows[0].tenant_id,
        userId: res.rows[0].user_id,
        role: res.rows[0].role,
        status: res.rows[0].status,
        sessionVersion: res.rows[0].session_version,
      } : null;
    } else {
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.sub,
          tenantId: user.tid,
        },
      });
    }

    if (!membership) {
      throw new ForbiddenException(`User ${user.sub} is not a member of organization ${user.tid}`);
    }

    if (membership.status !== 'active') {
      throw new ForbiddenException(`User membership in organization ${user.tid} is ${membership.status}`);
    }

    // Assert session version matches (for immediate session revocation)
    if (user.sessionVersion !== undefined && membership.sessionVersion > user.sessionVersion) {
      throw new UnauthorizedException('Session has been revoked due to credential or membership changes');
    }

    // Populate validated tenant context on request for downstream handlers and controllers
    (request as any).tenant = {
      userId: user.sub,
      tenantId: user.tid,
      role: membership.role,
      status: membership.status,
      sessionVersion: membership.sessionVersion,
      permissions: ['*'],
      email: user.email,
    };

    return true;
  }
}
