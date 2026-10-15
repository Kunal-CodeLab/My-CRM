import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller('api/v1/crm/outbox')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class OutboxController {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly worker: OutboxRelayWorker,
  ) {}

  @Get()
  async listEvents(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tenantId = req.tenant.tenantId;
    const l = limit ? parseInt(limit, 10) : 50;
    const o = offset ? parseInt(offset, 10) : 0;
    return this.outboxService.listEvents(tenantId, status, l, o);
  }

  @Post('process')
  async triggerProcessing(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 10;
    return this.worker.processBatch(l);
  }

  @Post('claim')
  async claimEvents(@Body() body: { limit?: number; workerToken?: string }) {
    return this.outboxService.claimEvents(body.limit || 10, body.workerToken);
  }

  @Post(':id/complete')
  async completeEvent(
    @Param('id') id: string,
    @Body() body: { claimToken: string; fenceToken: number },
  ) {
    await this.outboxService.completeEvent(id, body.claimToken, body.fenceToken);
    return { success: true };
  }

  @Post(':id/fail')
  async failEvent(
    @Param('id') id: string,
    @Body() body: { claimToken: string; fenceToken: number; isUnknownOutcome?: boolean; errorMessage?: string },
  ) {
    await this.outboxService.failEvent(id, body.claimToken, body.fenceToken, body.isUnknownOutcome, body.errorMessage);
    return { success: true };
  }
}
