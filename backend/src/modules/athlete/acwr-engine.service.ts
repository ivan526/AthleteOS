import { Injectable, Logger } from '@nestjs/common';
import { Activity } from '@prisma/client';
import { AcwrResult, DataQuality, AcwrLevel } from './types';

/**
 * ACWR (Acute Chronic Workload Ratio) 计算引擎
 * 实现PRD第10节要求
 */
@Injectable()
export class AcwrEngineService {
  private readonly logger = new Logger(AcwrEngineService.name);

  /**
   * 计算ACWR
   * acute_load = 过去7天的TSS总和
   * chronic_load = 过去28天的TSS总和 / 4
   * acwr = acute_load / chronic_load
   */
  calculate(activities: Activity[], referenceDate: Date = new Date()): AcwrResult {
    const sevenDaysAgo = new Date(referenceDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const twentyEightDaysAgo = new Date(referenceDate);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    // 过滤过去28天的活动
    const last28Days = activities.filter(
      activity => activity.startTime >= twentyEightDaysAgo && activity.startTime < referenceDate,
    );

    // 过滤过去7天的活动
    const last7Days = last28Days.filter(
      activity => activity.startTime >= sevenDaysAgo,
    );

    // 计算历史天数
    if (last28Days.length === 0) {
      return {
        acwr: null,
        acuteLoad: 0,
        chronicLoad: 0,
        level: 'high',
        dataQuality: 'insufficient',
        confidence: 0,
        message: '无历史训练数据，无法计算ACWR',
      };
    }

    // 计算最早和最晚活动日期
    const dates = last28Days.map(a => a.startTime);
    const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const historyDays = Math.ceil((referenceDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));

    // 历史天数不足28天的情况
    if (historyDays < 28) {
      const acuteLoad = this.sumTss(last7Days);
      const chronicLoad = this.sumTss(last28Days) / Math.ceil(historyDays / 7);

      return {
        acwr: chronicLoad > 0 ? acuteLoad / chronicLoad : null,
        acuteLoad,
        chronicLoad,
        level: this.getAcwrLevel(acuteLoad / chronicLoad),
        dataQuality: 'low',
        confidence: 0.3,
        message: '历史数据不足28天，ACWR计算仅供参考',
      };
    }

    const acuteLoad = this.sumTss(last7Days);
    const chronicLoad = this.sumTss(last28Days) / 4; // 周平均

    // 慢性负荷为0的情况
    if (chronicLoad === 0) {
      return {
        acwr: null,
        acuteLoad,
        chronicLoad: 0,
        level: 'high',
        dataQuality: 'insufficient',
        confidence: 0,
        message: '历史训练负荷为0，无法计算ACWR',
      };
    }

    const acwr = acuteLoad / chronicLoad;
    const level = this.getAcwrLevel(acwr);

    // 数据质量评估
    const tssCount28d = last28Days.filter(a => a.tss != null).length;
    const dataQuality: DataQuality =
      tssCount28d >= 20 ? 'high' : tssCount28d >= 10 ? 'medium' : 'low';

    const confidence = dataQuality === 'high' ? 0.8 : dataQuality === 'medium' ? 0.6 : 0.4;

    return {
      acwr,
      acuteLoad,
      chronicLoad,
      level,
      dataQuality,
      confidence,
    };
  }

  /**
   * 计算TSS总和
   */
  private sumTss(activities: Activity[]): number {
    return activities.reduce((sum, activity) => sum + (activity.tss || 0), 0);
  }

  /**
   * ACWR等级映射
   * 参考PRD第1402-1406行
   */
  private getAcwrLevel(acwr: number): AcwrLevel {
    if (acwr < 0.8) return 'underload';
    if (acwr < 1.3) return 'optimal';
    if (acwr < 1.5) return 'elevated';
    return 'high';
  }
}
