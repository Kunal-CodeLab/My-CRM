import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { OutboxModule } from './outbox/outbox.module';
import { AuditModule } from './audit/audit.module';
import { CsvModule } from './csv/csv.module';
import { OpsModule } from './ops/ops.module';
import { TeamModule } from './team/team.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CrmModule,
    OutboxModule,
    AuditModule,
    CsvModule,
    OpsModule,
    TeamModule,
  ],
})
export class AppModule {}
