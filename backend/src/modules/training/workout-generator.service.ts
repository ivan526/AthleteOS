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
          warmup: '5分钟轻松踩踏，逐步提高踏频',
          mainSet: '低强度骑行，保持轻松踩踏和顺畅圆周发力',
          cooldown: '5分钟低阻力放松骑',
        },
      },
      easy_ride: {
        title: '轻松骑',
        intensity: 'easy',
        tssPerMinute: 0.7,
        structure: {
          warmup: '10分钟轻松踩踏',
          mainSet: '有氧骑行，保持平稳呼吸与舒适踏频',
          cooldown: '5分钟低阻力放松骑',
        },
      },
      endurance_ride: {
        title: '耐力骑',
        intensity: 'moderate',
        tssPerMinute: 0.9,
        structure: {
          warmup: '10分钟由轻松逐步进入有氧强度',
          mainSet: '稳定输出，保持有氧耐力区间，避免频繁冲刺',
          cooldown: '10分钟轻松骑',
        },
      },
      tempo_ride: {
        title: '节奏骑',
        intensity: 'moderate',
        tssPerMinute: 1.2,
        structure: {
          warmup: '15分钟热身，加入3次短加速',
          mainSet: '2组15分钟节奏强度骑行，组间轻松骑5分钟',
          cooldown: '10分钟轻松骑',
        },
      },
      interval_ride: {
        title: '间歇骑',
        intensity: 'high',
        tssPerMinute: 1.4,
        structure: {
          warmup: '15分钟热身，加入高踏频激活',
          mainSet: '5组3分钟高强度骑行，组间轻松骑3分钟',
          cooldown: '10分钟轻松骑',
        },
      },
    },
    swimming: {
      recovery_swim: {
        title: '恢复游',
        intensity: 'easy',
        tssPerMinute: 0.4,
        structure: {
          warmup: '200米轻松游，专注水感',
          mainSet: '轻松连续游，保持动作舒展和呼吸稳定',
          cooldown: '100米放松游',
        },
      },
      easy_swim: {
        title: '轻松游',
        intensity: 'easy',
        tssPerMinute: 0.6,
        structure: {
          warmup: '300米轻松游与技术练习',
          mainSet: '均匀完成有氧游，保持动作完整',
          cooldown: '200米放松游',
        },
      },
      endurance_swim: {
        title: '耐力游',
        intensity: 'moderate',
        tssPerMinute: 0.8,
        structure: {
          warmup: '400米轻松游，加入划水技术练习',
          mainSet: '4组400米有氧游，组间休息45秒',
          cooldown: '200米放松游',
        },
      },
      tempo_swim: {
        title: '节奏游',
        intensity: 'moderate',
        tssPerMinute: 1.0,
        structure: {
          warmup: '400米热身，加入4组50米渐进',
          mainSet: '8组100米稳定节奏游，组间休息20秒',
          cooldown: '200米放松游',
        },
      },
      interval_swim: {
        title: '间歇游',
        intensity: 'high',
        tssPerMinute: 1.2,
        structure: {
          warmup: '500米热身与技术练习',
          mainSet: '12组50米高强度游，组间休息30秒',
          cooldown: '300米放松游',
        },
      },
    },
    strength: {
      mobility: {
        title: '灵活性训练',
        intensity: 'easy',
        tssPerMinute: 0.3,
        structure: {
          warmup: '5分钟轻度活动提升体温',
          mainSet: '全身关节活动、动态拉伸与呼吸控制',
          cooldown: '5分钟轻柔静态拉伸',
        },
      },
      core_strength: {
        title: '核心力量训练',
        intensity: 'moderate',
        tssPerMinute: 0.6,
        structure: {
          warmup: '8分钟动态热身和核心激活',
          mainSet: '3轮核心稳定训练，包括平板支撑、死虫和侧桥',
          cooldown: '5分钟腰背与髋部放松',
        },
      },
      light_strength: {
        title: '轻力量训练',
        intensity: 'moderate',
        tssPerMinute: 0.7,
        structure: {
          warmup: '10分钟动态热身与动作准备',
          mainSet: '全身轻重量力量训练，动作质量优先，保留3次余力',
          cooldown: '5分钟拉伸与呼吸恢复',
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
    date: Date = new Date(),
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
      date.toISOString().slice(0, 10),
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
    dateId?: string,
  ): WorkoutType {
    // 恢复日
    if (dayType === 'recovery') {
      if (sport === 'running') return 'recovery_run';
      if (sport === 'cycling') return 'recovery_ride';
      if (sport === 'swimming') return 'recovery_swim';
      return 'mobility';
    }

    // 轻松日
    if (dayType === 'easy') {
      if (sport === 'running') return 'easy_run';
      if (sport === 'cycling') return 'easy_ride';
      if (sport === 'swimming') return 'easy_swim';
      return 'light_strength';
    }

    // 中等强度日
    if (dayType === 'moderate') {
      // 数据等级低时不建议节奏跑
      if ((dataLevel === 'D' || dataLevel === 'C') && allowedIntensities.includes('moderate')) {
        if (sport === 'running') return 'steady_run';
        if (sport === 'cycling') return 'endurance_ride';
        if (sport === 'swimming') return 'endurance_swim';
        return 'core_strength';
      }

      if (allowedIntensities.includes('moderate')) {
        const useFirstVariant = this.selectDailyVariant(`${dateId ?? ''}:${sport}`);
        if (sport === 'running') return useFirstVariant ? 'steady_run' : 'tempo_run';
        if (sport === 'cycling') return useFirstVariant ? 'endurance_ride' : 'tempo_ride';
        if (sport === 'swimming') return useFirstVariant ? 'endurance_swim' : 'tempo_swim';
        return useFirstVariant ? 'core_strength' : 'light_strength';
      }
      return this.getEasyWorkoutType(sport);
    }

    // 高强度日
    if (dayType === 'hard' && allowedIntensities.includes('high') && dataLevel === 'A') {
      if (sport === 'running') return 'interval_run';
      if (sport === 'cycling') return 'interval_ride';
      if (sport === 'swimming') return 'interval_swim';
      return 'core_strength';
    }

    // 默认选择
    if (sport === 'running') return 'easy_run';
    if (sport === 'cycling') return 'easy_ride';
    if (sport === 'swimming') return 'easy_swim';
    return 'mobility';
  }

  private selectDailyVariant(seed: string): boolean {
    let hash = 0;
    for (const character of seed) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return hash % 2 === 0;
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
    if (sport === 'swimming' && this.workoutTemplates.swimming[workoutType as keyof typeof this.workoutTemplates.swimming]) {
      return this.workoutTemplates.swimming[workoutType as keyof typeof this.workoutTemplates.swimming];
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
        adjusted.type = this.getEasyWorkoutType(original.sport);
        adjusted.structure = this.getTemplate(adjusted.type, original.sport).structure;
        adjusted.intensity = 'easy';
        adjusted.durationMinutes = Math.round(original.durationMinutes * 0.7);
        adjusted.expectedTss = Math.round(original.expectedTss * 0.6);
        adjusted.title = this.getTemplate(adjusted.type, original.sport).title;
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
        if (
          newSport &&
          ['running', 'cycling', 'swimming', 'strength'].includes(newSport)
        ) {
          const targetType = this.getEquivalentWorkoutType(original.intensity, newSport);
          const targetTemplate = this.getTemplate(targetType, newSport);
          adjusted.sport = newSport;
          adjusted.type = targetType;
          adjusted.title = targetTemplate.title;
          adjusted.intensity = targetTemplate.intensity as Intensity;
          adjusted.structure = targetTemplate.structure;
          adjusted.expectedTss = Math.round(
            adjusted.durationMinutes * targetTemplate.tssPerMinute,
          );
        }
        break;

      case 'prefer_easy':
        // 改为轻松训练
        adjusted.type = this.getEasyWorkoutType(original.sport);
        adjusted.structure = this.getTemplate(adjusted.type, original.sport).structure;
        adjusted.intensity = 'easy';
        adjusted.title = this.getTemplate(adjusted.type, original.sport).title;
        adjusted.expectedTss = Math.round(original.expectedTss * 0.7);
        break;

      case 'skip_today':
        adjusted.sport = 'strength';
        adjusted.type = 'mobility';
        adjusted.title = '今日休息';
        adjusted.durationMinutes = 0;
        adjusted.expectedTss = 0;
        adjusted.intensity = 'easy';
        adjusted.structure = { mainSet: '休息并关注恢复，可按舒适程度进行轻柔活动' };
        break;
    }

    return adjusted;
  }

  private getEasyWorkoutType(sport: Sport): WorkoutType {
    if (sport === 'running') return 'easy_run';
    if (sport === 'cycling') return 'easy_ride';
    if (sport === 'swimming') return 'easy_swim';
    return 'mobility';
  }

  private getEquivalentWorkoutType(
    intensity: Intensity,
    sport: Sport,
  ): WorkoutType {
    if (intensity === 'high') {
      if (sport === 'running') return 'interval_run';
      if (sport === 'cycling') return 'interval_ride';
      if (sport === 'swimming') return 'interval_swim';
      return 'core_strength';
    }

    if (intensity === 'moderate') {
      if (sport === 'running') return 'steady_run';
      if (sport === 'cycling') return 'endurance_ride';
      if (sport === 'swimming') return 'endurance_swim';
      return 'light_strength';
    }

    if (sport === 'running') return 'recovery_run';
    if (sport === 'cycling') return 'recovery_ride';
    if (sport === 'swimming') return 'recovery_swim';
    return 'mobility';
  }
}
