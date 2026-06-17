import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SettingsController } from './settings.controller';
import { IntervalsApiService } from './intervals-api.service';
import { GarminApiService } from './garmin-api.service';
import { MockDataService } from './mock-data.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SyncController, SettingsController],
  providers: [SyncService, IntervalsApiService, GarminApiService, MockDataService],
  exports: [SyncService, IntervalsApiService, GarminApiService, MockDataService],
})
export class SyncModule {}
