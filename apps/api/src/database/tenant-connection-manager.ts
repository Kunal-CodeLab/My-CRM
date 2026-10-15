import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export class InvalidTenantContextException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantContextException';
  }
}

@Injectable()
export class TenantConnectionManager {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Validates that a tenant ID is present and conforms to RFC 9562 / RFC 4122 UUID syntax.
   */
  public validateTenantId(tenantId: unknown): asserts tenantId is string {
    if (!tenantId || typeof tenantId !== 'string' || !TenantConnectionManager.UUID_REGEX.test(tenantId)) {
      throw new InvalidTenantContextException(
        `Security Error: Invalid or missing tenant context: '${String(tenantId)}'`,
      );
    }
  }

  /**
   * Runs an operation inside an explicit interactive transaction where the PostgreSQL
   * session variable `app.current_tenant_id` is set locally (is_local = true).
   * Automatically clears upon transaction termination (COMMIT or ROLLBACK).
   */
  async runInTenantScope<T>(
    tenantId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.validateTenantId(tenantId);

    return this.prisma.$transaction(
      async (tx) => {
        // Set configuration local to THIS transaction block only
        await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantId}, true);
        `;

        return await operation(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}
