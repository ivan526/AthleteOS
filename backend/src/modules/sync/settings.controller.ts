import { Body, Controller, Get, Put, Post, Query } from '@nestjs/common';
import { CurrentUserService } from '../../shared/prisma/current-user.service';
import { SyncService } from './sync.service';

@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly syncService: SyncService,
  ) {}

  @Get()
  async getSettings() {
    const userId = await this.currentUser.getUserId();
    return this.syncService.getSettings(userId);
  }

  @Put()
  async updateSettings(
    @Body()
    body: {
      intervals_api_key?: string;
      intervals_athlete_id?: string;
      garmin_email?: string;
      garmin_password?: string;
      llm_provider?: string;
      llm_model?: string;
      llm_base_url?: string;
      llm_api_key?: string;
      llm_enabled?: boolean;
      primary_sport?: string;
      weekly_available_days?: number;
    },
  ) {
    const userId = await this.currentUser.getUserId();
    return this.syncService.updateSettings(userId, body);
  }

  @Post('sync')
  async syncWithSavedCredentials(@Query('days') days = '90') {
    const userId = await this.currentUser.getUserId();
    return this.syncService.syncIntervalsData(userId, Number(days) >= 90);
  }
}
