import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CrmController],
  providers: [
    CrmService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [CrmService],
})
export class CrmModule {}
