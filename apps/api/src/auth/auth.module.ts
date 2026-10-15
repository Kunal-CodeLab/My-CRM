import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import { TokenService } from './token-service';
import { AuthController, InvitationsController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantMembershipGuard } from './guards/tenant-membership.guard';

@Module({
  controllers: [AuthController, InvitationsController],
  providers: [
    AuthService,
    {
      provide: TokenService,
      useFactory: () => new TokenService(),
    },
    JwtAuthGuard,
    TenantMembershipGuard,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [AuthService, TokenService, JwtAuthGuard, TenantMembershipGuard],
})
export class AuthModule {}
