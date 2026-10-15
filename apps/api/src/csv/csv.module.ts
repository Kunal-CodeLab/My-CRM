import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CsvService } from './csv.service';
import { CsvController } from './csv.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CsvController],
  providers: [
    CsvService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
  ],
  exports: [CsvService],
})
export class CsvModule {}
