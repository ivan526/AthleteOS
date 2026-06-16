import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { IntervalsApiService } from './intervals-api.service';
import { MockDataService } from './mock-data.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SyncController],
  providers: [SyncService, IntervalsApiService, MockDataService],
  exports: [SyncService, IntervalsApiService, MockDataService],
})
export class SyncModule {}
