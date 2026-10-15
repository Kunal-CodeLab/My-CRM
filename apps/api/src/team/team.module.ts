import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TeamController],
  providers: [
    TeamService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [TeamService],
})
export class TeamModule {}
