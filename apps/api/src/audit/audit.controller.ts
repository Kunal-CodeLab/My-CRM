import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { LawfulErasureRequest, SetLegalHoldRequest, PartitionPurgeRequest } from '@crm/shared-types';

@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class AuditController {
  // Ephemeral key pair for local signing/verification demonstration
  private static readonly defaultKeyPair = new AuditService({} as any).generateEd25519KeyPair();

  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async listLogs(
    @Req() req: any,
    @Query('entityName') entityName?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tenantId = req.tenant.tenantId;
    const l = limit ? parseInt(limit, 10) : 50;
    const o = offset ? parseInt(offset, 10) : 0;
    return this.auditService.listAuditLogs(tenantId, entityName, entityId, l, o);
  }

  @Get('amendments')
  async listAmendments(
    @Req() req: any,
    @Query('targetEntityName') targetEntityName?: string,
    @Query('targetEntityId') targetEntityId?: string,
  ) {
    const tenantId = req.tenant.tenantId;
    return this.auditService.listAmendments(tenantId, targetEntityName, targetEntityId);
  }

  @Post('ticket/sample')
  async createSampleTicket(
    @Req() req: any,
    @Body() body: { targetEntityName: string; targetEntityId: string; expiresInSeconds?: number },
  ) {
    const tenantId = req.tenant.tenantId;
    const ticket = this.auditService.createErasureTicket(AuditController.defaultKeyPair.privateKey, {
      tenantId,
      targetEntityName: body.targetEntityName,
      targetEntityId: body.targetEntityId,
      keyId: 'ed25519-key-primary-1',
      expiresInSeconds: body.expiresInSeconds || 3600,
    });
    return {
      ticket,
      publicKeyPem: AuditController.defaultKeyPair.publicKey,
    };
  }

  @Post('lawful-erasure')
  async executeLawfulErasure(
    @Req() req: any,
    @Body() body: LawfulErasureRequest & { publicKeyPem?: string },
  ) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    const trustedKey = body.publicKeyPem || AuditController.defaultKeyPair.publicKey;
    return this.auditService.executeLawfulErasure(tenantId, actor, body, trustedKey);
  }

  @Post('legal-hold')
  async setLegalHold(@Req() req: any, @Body() body: SetLegalHoldRequest) {
    const tenantId = req.tenant.tenantId;
    await this.auditService.setLegalHold(tenantId, body.legalHold);
    return { success: true, legalHold: body.legalHold };
  }

  @Post('partitions/purge')
  async purgePartition(@Body() body: PartitionPurgeRequest) {
    return this.auditService.failClosedPartitionPurge(body.partitionName, body.dryRun ?? false);
  }
}
