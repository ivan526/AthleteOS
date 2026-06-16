import { Controller, Post, Get, Request, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * 触发Intervals.icu数据同步
   */
  @Post('intervals')
  async syncIntervals(
    @Body() body: { fullSync?: boolean },
    @Request() req: any,
  ) {
    // TODO: 替换为真实用户ID，待认证系统完成后
    const userId = 'b23d32aa-870a-449e-8572-b1fccd8c00e0'; // 临时测试用户ID

    const result = await this.syncService.syncIntervalsData(
      userId,
      body.fullSync || false,
    );

    return result;
  }

  /**
   * 获取同步状态
   */
  @Get('status')
  async getSyncStatus(@Request() req: any) {
    // TODO: 替换为真实用户ID
    const userId = 'test-user-id';

    const connectedAccount = await this.syncService['prisma'].connectedAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'intervals.icu',
        },
      },
      select: {
        syncStatus: true,
        syncMessage: true,
        lastSyncAt: true,
      },
    });

    if (!connectedAccount) {
      return {
        syncStatus: 'not_connected',
        syncMessage: '未连接Intervals.icu',
        lastSyncAt: null,
      };
    }

    return connectedAccount;
  }
}
