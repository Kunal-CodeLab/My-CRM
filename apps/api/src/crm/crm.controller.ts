import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import {
  CreateAccountDtoSchema,
  UpdateAccountDtoSchema,
  CreateContactDtoSchema,
  UpdateContactDtoSchema,
  CreateDealDtoSchema,
  UpdateDealDtoSchema,
  TransitionDealStageDtoSchema,
  CreateActivityDtoSchema,
} from './dto/crm.dto';
import { TenantContext } from '@crm/shared-types';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  private getActor(req: AuthenticatedRequest): TenantContext {
    if ((req as any).tenant) {
      return (req as any).tenant;
    }
    const user = req.user!;
    return {
      userId: user.sub,
      tenantId: user.tid,
      role: user.role as any,
      sessionVersion: user.sessionVersion || 1,
    };
  }

  // ==========================================
  // ACCOUNTS
  // ==========================================

  @Get('accounts')
  async listAccounts(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('q') search?: string
  ) {
    const actor = this.getActor(req);
    return this.crmService.listAccounts(actor.tenantId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
      search,
    });
  }

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Req() req: AuthenticatedRequest, @Body() rawBody: unknown) {
    const actor = this.getActor(req);
    const parsed = CreateAccountDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.createAccount(actor.tenantId, actor, parsed.data);
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() rawBody: unknown
  ) {
    const actor = this.getActor(req);
    const parsed = UpdateAccountDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.updateAccount(actor.tenantId, actor, id, parsed.data);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const actor = this.getActor(req);
    await this.crmService.deleteAccount(actor.tenantId, actor, id);
  }

  // ==========================================
  // CONTACTS
  // ==========================================

  @Get('contacts')
  async listContacts(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('accountId') accountId?: string
  ) {
    const actor = this.getActor(req);
    return this.crmService.listContacts(actor.tenantId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
      accountId,
    });
  }

  @Post('contacts')
  @HttpCode(HttpStatus.CREATED)
  async createContact(@Req() req: AuthenticatedRequest, @Body() rawBody: unknown) {
    const actor = this.getActor(req);
    const parsed = CreateContactDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.createContact(actor.tenantId, actor, parsed.data);
  }

  @Patch('contacts/:id')
  async updateContact(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() rawBody: unknown
  ) {
    const actor = this.getActor(req);
    const parsed = UpdateContactDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.updateContact(actor.tenantId, actor, id, parsed.data);
  }

  @Delete('contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContact(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const actor = this.getActor(req);
    await this.crmService.deleteContact(actor.tenantId, actor, id);
  }

  // ==========================================
  // PIPELINES & STAGES
  // ==========================================

  @Get('pipelines')
  async listPipelines(@Req() req: AuthenticatedRequest) {
    const actor = this.getActor(req);
    return this.crmService.listPipelines(actor.tenantId);
  }

  // ==========================================
  // DEALS & STAGE TRANSITIONS
  // ==========================================

  @Get('deals')
  async listDeals(
    @Req() req: AuthenticatedRequest,
    @Query('pipelineId') pipelineId?: string,
    @Query('stageId') stageId?: string
  ) {
    const actor = this.getActor(req);
    return this.crmService.listDeals(actor.tenantId, { pipelineId, stageId });
  }

  @Post('deals')
  @HttpCode(HttpStatus.CREATED)
  async createDeal(@Req() req: AuthenticatedRequest, @Body() rawBody: unknown) {
    const actor = this.getActor(req);
    const parsed = CreateDealDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.createDeal(actor.tenantId, actor, parsed.data);
  }

  @Patch('deals/:id/stage')
  async transitionDealStage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() rawBody: unknown
  ) {
    const actor = this.getActor(req);
    const parsed = TransitionDealStageDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.transitionDealStage(actor.tenantId, actor, id, parsed.data);
  }

  @Patch('deals/:id')
  async updateDeal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() rawBody: unknown
  ) {
    const actor = this.getActor(req);
    const parsed = UpdateDealDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.updateDeal(actor.tenantId, actor, id, parsed.data);
  }

  @Delete('deals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDeal(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const actor = this.getActor(req);
    await this.crmService.deleteDeal(actor.tenantId, actor, id);
  }

  // ==========================================
  // ACTIVITIES
  // ==========================================

  @Get('activities')
  async listActivities(
    @Req() req: AuthenticatedRequest,
    @Query('dealId') dealId?: string,
    @Query('contactId') contactId?: string,
    @Query('accountId') accountId?: string
  ) {
    const actor = this.getActor(req);
    return this.crmService.listActivities(actor.tenantId, { dealId, contactId, accountId });
  }

  @Post('activities')
  @HttpCode(HttpStatus.CREATED)
  async createActivity(@Req() req: AuthenticatedRequest, @Body() rawBody: unknown) {
    const actor = this.getActor(req);
    const parsed = CreateActivityDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    return this.crmService.createActivity(actor.tenantId, actor, parsed.data);
  }
}
