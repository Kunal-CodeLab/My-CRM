import { Controller, Get, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { OpsService } from './ops.service';
import { PiiScrubberInterceptor } from './pii-scrubber.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller()
@UseInterceptors(PiiScrubberInterceptor)
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  /**
   * Public Liveness probe
   */
  @Get('healthz')
  async getHealthz() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Public Readiness probe
   */
  @Get('readyz')
  async getReadyz() {
    await this.opsService.assertReadiness();
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  /**
   * Detailed authenticated health telemetry
   */
  @Get('api/v1/ops/health')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async getDetailedHealth() {
    return this.opsService.getHealth();
  }

  /**
   * Monthly automated PITR restoration drill runner
   */
  @Post('api/v1/ops/backup-drill')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async triggerBackupDrill(@Req() req: any) {
    const actor = req?.tenant;
    return this.opsService.runBackupRestorationDrill(actor);
  }

  /**
   * Concurrency & latency SLO benchmark simulator
   */
  @Post('api/v1/ops/load-benchmark')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async triggerLoadBenchmark(@Req() req: any, @Body() body: { virtualUsers?: number; iterations?: number }) {
    const actor = req?.tenant;
    const vu = body?.virtualUsers || 50;
    const it = body?.iterations || 20;
    return this.opsService.runLoadBenchmarkSimulation(vu, it, actor);
  }
}
