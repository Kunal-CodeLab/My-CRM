import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OpsService } from './ops.service';
import { OpsController } from './ops.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OpsController],
  providers: [
    OpsService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [OpsService],
})
export class OpsModule {}
