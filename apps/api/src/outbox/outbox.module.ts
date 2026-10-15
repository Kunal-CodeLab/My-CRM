import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OutboxService } from './outbox.service';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { OutboxController } from './outbox.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OutboxController],
  providers: [
    OutboxService,
    OutboxRelayWorker,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [OutboxService, OutboxRelayWorker],
})
export class OutboxModule {}
