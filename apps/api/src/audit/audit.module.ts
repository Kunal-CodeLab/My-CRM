import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
