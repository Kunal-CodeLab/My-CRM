import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { PiiScrubberInterceptor } from '../ops/pii-scrubber.interceptor';
import { CreateInvitationRequest, UpdateMemberRoleRequest } from '@crm/shared-types';

@Controller('api/v1/team')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
@UseInterceptors(PiiScrubberInterceptor)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * List all team members within active tenant
   */
  @Get('members')
  async listMembers(@Req() req: any) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.listMembers(tenantId, actor);
  }

  /**
   * Issue a secure token invitation to a new team member
   */
  @Post('invitations')
  async createInvitation(@Req() req: any, @Body() body: CreateInvitationRequest) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.createInvitation(tenantId, actor, body);
  }

  /**
   * List pending invitations
   */
  @Get('invitations')
  async listInvitations(@Req() req: any) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.listInvitations(tenantId, actor);
  }

  /**
   * Cancel an unaccepted invitation
   */
  @Delete('invitations/:id')
  async cancelInvitation(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.cancelInvitation(tenantId, actor, id);
  }

  /**
   * Update member role
   */
  @Patch('members/:id/role')
  async updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateMemberRoleRequest,
  ) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.updateMemberRole(tenantId, actor, id, body);
  }

  /**
   * Revoke member access
   */
  @Delete('members/:id')
  async revokeMember(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant.tenantId;
    const actor = req.tenant;
    return this.teamService.revokeMember(tenantId, actor, id);
  }
}
