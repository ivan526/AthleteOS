import { Injectable, Logger } from '@nestjs/common';
import { DailyAthleteState } from '../athlete/types';
import { WorkoutRecommendation, DayType, Intensity, WorkoutType, Sport } from './types';

/**
 * 训练计划生成器
 * 实现PRD第13节要求
 */
@Injectable()
export class WorkoutGeneratorService {
  private readonly logger = new Logger(WorkoutGeneratorService.name);

  /**
   * 训练模板库
   */
  private readonly workoutTemplates = {
    running: {
      recovery_run: {
        title: '恢复跑',
        intensity: 'easy',
        tssPerMinute: 0.6,
        structure: {
          warmup: '5分钟轻松跑',
          mainSet: '全程保持轻松配速，可以边跑边说话',
          cooldown: '5分钟慢走',
        },
      },
      easy_run: {
        title: '轻松跑',
        intensity: 'easy',
        tssPerMinute: 0.8,
        structure: {
          warmup: '10分钟轻松跑',
          mainSet: '保持有氧配速，呼吸平稳',
          cooldown: '5分钟慢走拉伸',
        },
      },
      steady_run: {
        title: '有氧跑',
        intensity: 'moderate',
        tssPerMinute: 1.0,
        structure: {
          warmup: '10分钟轻松跑',
          mainSet: '保持稳定的马拉松配速',
          cooldown: '5分钟放松跑',
        },
      },
      tempo_run: {
        title: '节奏跑',
        intensity: 'moderate',
        tssPerMinute: 1.3,
        structure: {
          warmup: '10分钟轻松跑',
          mainSet: '20分钟阈值配速跑，呼吸略有压力但可维持',
          cooldown: '10分钟放松跑',
        },
      },
      interval_run: {
        title: '间歇跑',
        intensity: 'high',
        tssPerMinute: 1.5,
        structure: {
          warmup: '15分钟轻松跑+加速跑',
          mainSet: '8组400米快跑，组间休息2分钟',
          cooldown: '10分钟放松跑+拉伸',
        },
      },
      long_easy_run: {
        title: '长距离慢跑',
        intensity: 'easy',
        tssPerMinute: 0.9,
        structure: {
          warmup: '10分钟轻松跑',
          mainSet: '全程保持低强度有氧配速，注意补水',
          cooldown: '10分钟慢走+充分拉伸',
        },
      },
    },
    cycling: {
      recovery_ride: {
        title: '恢复骑',
        intensity: 'easy',
        tssPerMinute: 0.5,
        structure: {
          mainSet: '低强度骑行，保持轻松踩踏',
        },
      },
      easy_ride: {
        title: '轻松骑',
        intensity: 'easy',
        tssPerMinute: 0.7,
        structure: {
          mainSet: '有氧骑行，保持平稳呼吸',
        },
      },
      endurance_ride: {
        title: '耐力骑',
        intensity: 'moderate',
        tssPerMinute: 0.9,
        structure: {
          mainSet: '稳定输出，保持有氧运动强度',
        },
      },
      tempo_ride: {
        title: '节奏骑',
        intensity: 'moderate',
        tssPerMinute: 1.2,
        structure: {
          mainSet: '阈值强度骑行，提升耐力',
        },
      },
      interval_ride: {
        title: '间歇骑',
        intensity: 'high',
        tssPerMinute: 1.4,
        structure: {
          mainSet: '高强度间歇训练，组间充分休息',
        },
      },
    },
    strength: {
      mobility: {
        title: '灵活性训练',
        intensity: 'easy',
        tssPerMinute: 0.3,
        structure: {
          mainSet: '全身关节活动和动态拉伸',
        },
      },
      core_strength: {
        title: '核心力量训练',
        intensity: 'moderate',
        tssPerMinute: 0.6,
        structure: {
          mainSet: '核心肌群训练，包括平板支撑、卷腹等',
        },
      },
      light_strength: {
        title: '轻力量训练',
        intensity: 'moderate',
        tssPerMinute: 0.7,
        structure: {
          mainSet: '下肢和上身轻重量力量训练',
        },
      },
    },
  };

  /**
   * 生成训练建议
   */
  generateWorkout(
    state: DailyAthleteState,
    preferredSport: Sport = 'running',
    availableTimeMinutes: number = 60,
    allowedTypes?: WorkoutType[],
  ): WorkoutRecommendation {
    const dayType = this.getDayTypeFromCapacity(state.trainingCapacity.score);

    // 根据安全规则确定允许的强度
    const allowedIntensities = this.getAllowedIntensities(state);

    // 选择合适的训练类型
    const workoutType = this.selectWorkoutType(
      dayType,
      preferredSport,
      allowedIntensities,
      allowedTypes,
      state.dataLevel,
    );

    // 计算合适的时长和TSS
    const { duration, tss } = this.calculateDurationAndTss(
      workoutType,
      preferredSport,
      dayType,
      availableTimeMinutes,
      state.trainingCapacity.score,
    );

    // 获取训练模板
    const template = this.getTemplate(workoutType, preferredSport);

    return {
      sport: preferredSport,
      type: workoutType,
      title: template.title,
      durationMinutes: duration,
      expectedTss: tss,
      intensity: template.intensity as Intensity,
      structure: template.structure,
    };
  }

  /**
   * 根据训练能力分数确定日类型
   * 参考PRD第1402-1406行
   */
  private getDayTypeFromCapacity(capacityScore: number): DayType {
    if (capacityScore >= 80) return 'hard';
    if (capacityScore >= 61) return 'moderate';
    if (capacityScore >= 41) return 'easy';
    return 'recovery';
  }

  /**
   * 根据状态确定允许的强度
   */
  private getAllowedIntensities(state: DailyAthleteState): Intensity[] {
    // 如果触发了安全规则，只允许低强度
    if (state.hardSafety?.triggered) {
      return ['easy'];
    }

    // 风险高时限制强度
    if (state.trainingRisk.level === 'elevated' || state.trainingRisk.level === 'high_caution') {
      return ['easy', 'moderate'];
    }

    // data_level低时禁止高强度
    if (state.dataLevel === 'D' || state.dataLevel === 'C') {
      return ['easy', 'moderate'];
    }

    return ['easy', 'moderate', 'high'];
  }

  /**
   * 选择合适的训练类型
   */
  private selectWorkoutType(
    dayType: DayType,
    sport: Sport,
    allowedIntensities: Intensity[],
    allowedTypes?: WorkoutType[],
    dataLevel?: string,
  ): WorkoutType {
    // 恢复日
    if (dayType === 'recovery') {
      if (sport === 'running') return 'recovery_run';
      if (sport === 'cycling') return 'recovery_ride';
      return 'mobility';
    }

    // 轻松日
    if (dayType === 'easy') {
      if (sport === 'running') return 'easy_run';
      if (sport === 'cycling') return 'easy_ride';
      return 'light_strength';
    }

    // 中等强度日
    if (dayType === 'moderate') {
      // 数据等级低时不建议节奏跑
      if ((dataLevel === 'D' || dataLevel === 'C') && allowedIntensities.includes('moderate')) {
        if (sport === 'running') return 'steady_run';
        if (sport === 'cycling') return 'endurance_ride';
      }

      if (allowedIntensities.includes('moderate')) {
        if (sport === 'running') return Math.random() > 0.5 ? 'steady_run' : 'tempo_run';
        if (sport === 'cycling') return Math.random() > 0.5 ? 'endurance_ride' : 'tempo_ride';
      }
      return sport === 'running' ? 'easy_run' : 'easy_ride';
    }

    // 高强度日
    if (dayType === 'hard' && allowedIntensities.includes('high') && dataLevel === 'A') {
      if (sport === 'running') return 'interval_run';
      if (sport === 'cycling') return 'interval_ride';
    }

    // 默认选择
    if (sport === 'running') return 'easy_run';
    if (sport === 'cycling') return 'easy_ride';
    return 'mobility';
  }

  /**
   * 计算训练时长和TSS
   */
  private calculateDurationAndTss(
    workoutType: WorkoutType,
    sport: Sport,
    dayType: DayType,
    maxDuration: number,
    capacityScore: number,
  ): { duration: number; tss: number } {
    const template = this.getTemplate(workoutType, sport);

    // 根据能力和日类型调整时长
    let duration: number;
    if (dayType === 'recovery') {
      duration = Math.min(30, maxDuration);
    } else if (dayType === 'easy') {
      duration = Math.min(45, maxDuration);
    } else if (dayType === 'moderate') {
      duration = Math.min(60, maxDuration);
    } else {
      // hard
      duration = Math.min(75, maxDuration);
    }

    // 根据能力调整
    duration = Math.round(duration * (0.8 + (capacityScore / 100) * 0.4));

    // 计算TSS
    const tss = Math.round(duration * template.tssPerMinute);

    return { duration, tss };
  }

  /**
   * 获取训练模板
   */
  private getTemplate(workoutType: string, sport: string): any {
    if (sport === 'running' && this.workoutTemplates.running[workoutType as keyof typeof this.workoutTemplates.running]) {
      return this.workoutTemplates.running[workoutType as keyof typeof this.workoutTemplates.running];
    }
    if (sport === 'cycling' && this.workoutTemplates.cycling[workoutType as keyof typeof this.workoutTemplates.cycling]) {
      return this.workoutTemplates.cycling[workoutType as keyof typeof this.workoutTemplates.cycling];
    }
    if (this.workoutTemplates.strength[workoutType as keyof typeof this.workoutTemplates.strength]) {
      return this.workoutTemplates.strength[workoutType as keyof typeof this.workoutTemplates.strength];
    }

    // 默认模板
    return {
      title: '训练',
      intensity: 'moderate',
      tssPerMinute: 0.8,
      structure: { mainSet: '按照计划完成训练' },
    };
  }

  /**
   * 根据用户反馈调整训练
   */
  adjustWorkout(
    original: WorkoutRecommendation,
    feedbackType: string,
    availableTime?: number,
    newSport?: Sport,
  ): WorkoutRecommendation {
    let adjusted = { ...original };

    switch (feedbackType) {
      case 'too_tired':
        // 降低强度
        adjusted.type = original.sport === 'running' ? 'easy_run' : 'easy_ride';
        adjusted.structure = this.getTemplate(adjusted.type, original.sport).structure;
        adjusted.intensity = 'easy';
        adjusted.durationMinutes = Math.round(original.durationMinutes * 0.7);
        adjusted.expectedTss = Math.round(original.expectedTss * 0.6);
        adjusted.title = original.sport === 'running' ? '轻松跑' : '轻松骑';
        break;

      case 'not_enough_time':
        // 缩短时长
        if (availableTime) {
          adjusted.durationMinutes = availableTime;
          adjusted.expectedTss = Math.round(original.expectedTss * (availableTime / original.durationMinutes));
        } else {
          adjusted.durationMinutes = 30;
          adjusted.expectedTss = Math.round(original.expectedTss * 0.5);
        }
        adjusted.title = '短时' + adjusted.title;
        break;

      case 'pain_or_discomfort':
        // 改为恢复性训练
        adjusted.intensity = 'easy';
        adjusted.type = 'mobility';
        adjusted.title = '灵活性训练';
        adjusted.durationMinutes = 20;
        adjusted.expectedTss = 10;
        adjusted.sport = 'strength';
        adjusted.structure = { mainSet: '全身放松和拉伸，避免疼痛部位受力' };
        break;

      case 'change_sport':
        // 切换运动类型
        if (newSport) {
          adjusted.sport = newSport;
          adjusted.type = newSport === 'running' ? 'easy_run' : 'easy_ride';
          adjusted.title = newSport === 'running' ? '轻松跑' : '轻松骑';
        }
        break;

      case 'prefer_easy':
        // 改为轻松训练
        adjusted.type = original.sport === 'running' ? 'easy_run' : 'easy_ride';
        adjusted.structure = this.getTemplate(adjusted.type, original.sport).structure;
        adjusted.intensity = 'easy';
        adjusted.title = original.sport === 'running' ? '轻松跑' : '轻松骑';
        adjusted.expectedTss = Math.round(original.expectedTss * 0.7);
        break;
    }

    return adjusted;
  }
}
