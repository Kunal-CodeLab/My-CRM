import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CsvService } from './csv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { CreateImportRequest, ResumeImportRequest } from '@crm/shared-types';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  // ==========================================
  // EXPORTS
  // ==========================================

  @Post('exports/contacts')
  async exportContacts(@Req() req: any) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.csvService.createExportSnapshot(tenantId, actor, 'contacts');
  }

  @Post('exports/deals')
  async exportDeals(@Req() req: any) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.csvService.createExportSnapshot(tenantId, actor, 'deals');
  }

  @Get('exports/:id')
  async getExport(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant.tenantId;
    return this.csvService.getExportSnapshot(tenantId, id);
  }

  // ==========================================
  // IMPORTS
  // ==========================================

  @Post('imports/contacts')
  async createImport(@Req() req: any, @Body() body: CreateImportRequest) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.csvService.createImportJob(tenantId, actor, body);
  }

  @Post('imports/:id/process')
  async processImportChunk(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ResumeImportRequest,
  ) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.csvService.processImportChunk(tenantId, actor, id, body?.chunkSize || 100);
  }

  @Get('imports/:id')
  async getImport(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant.tenantId;
    return this.csvService.getImportJob(tenantId, id);
  }
}
