import { Controller, Post, Get, Body } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CurrentUserService } from '../../shared/prisma/current-user.service';

@Controller('api/sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly currentUser: CurrentUserService,
  ) {}

  /**
   * 触发Intervals.icu数据同步
   */
  @Post('intervals')
  async syncIntervals(
    @Body() body: { fullSync?: boolean },
  ) {
    const userId = await this.currentUser.getUserId();

    const result = await this.syncService.syncIntervalsData(
      userId,
      body.fullSync || false,
    );

    return result;
  }

  @Post('garmin')
  async syncGarmin(
    @Body() body: { fullSync?: boolean; mfa_code?: string },
  ) {
    const userId = await this.currentUser.getUserId();

    return this.syncService.syncGarminHrvData(
      userId,
      body.fullSync || false,
      body.mfa_code,
    );
  }

  @Post('daily')
  async syncDaily() {
    const userId = await this.currentUser.getUserId();
    return this.syncService.syncDailyData(userId);
  }

  /**
   * 获取同步状态
   */
  @Get('status')
  async getSyncStatus() {
    const userId = await this.currentUser.getUserId();
    return this.syncService.getStatus(userId);
  }
}
