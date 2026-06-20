import { DailyAthleteState } from '../athlete/types';
import { WorkoutGeneratorService } from './workout-generator.service';

describe('WorkoutGeneratorService multi-sport recommendations', () => {
  const service = new WorkoutGeneratorService();
  const state: DailyAthleteState = {
    userId: 'user-1',
    date: new Date('2026-06-20T00:00:00.000Z'),
    dataLevel: 'A',
    dataQuality: {
      overall: 'high',
      historyDays: 120,
      activityCount: 80,
    },
    trainingCapacity: {
      score: 72,
      status: 'Train Normally',
      confidence: 0.9,
      dataQuality: 'high',
      subscores: {},
      summary: '状态稳定',
    },
    trainingRisk: {
      score: 20,
      level: 'low',
      userLabel: '训练风险较低',
      confidence: 0.9,
      dataQuality: 'high',
      mainFactors: [],
      safeRecommendation: '可正常训练',
    },
    hardSafety: {
      triggered: false,
      rules: [],
    },
    confidence: 0.9,
  };

  it.each([
    ['running', ['steady_run', 'tempo_run'], '跑'],
    ['cycling', ['endurance_ride', 'tempo_ride'], '骑'],
    ['swimming', ['endurance_swim', 'tempo_swim'], '游'],
    ['strength', ['core_strength', 'light_strength'], '训练'],
  ] as const)(
    'generates a sport-specific %s workout',
    (sport, expectedTypes, titlePart) => {
      const result = service.generateWorkout(
        state,
        sport,
        60,
        undefined,
        new Date('2026-06-20T00:00:00.000Z'),
      );

      expect(expectedTypes).toContain(result.type);
      expect(result.title).toContain(titlePart);
      expect(result.structure.mainSet.length).toBeGreaterThan(10);
      expect(result.expectedTss).toBeGreaterThan(0);
    },
  );

  it('switches a running workout to a real cycling workout at the same intensity', () => {
    const result = service.adjustWorkout(
      {
        sport: 'running',
        type: 'steady_run',
        title: '有氧跑',
        durationMinutes: 50,
        expectedTss: 50,
        intensity: 'moderate',
        structure: { mainSet: '保持稳定配速' },
      },
      'change_sport',
      undefined,
      'cycling',
    );

    expect(result.sport).toBe('cycling');
    expect(result.type).toBe('endurance_ride');
    expect(result.title).toBe('耐力骑');
    expect(result.structure.mainSet).toContain('有氧耐力区间');
    expect(result.expectedTss).toBe(45);
  });

  it('uses recovery-safe templates when changing an easy workout to swimming', () => {
    const result = service.adjustWorkout(
      {
        sport: 'cycling',
        type: 'recovery_ride',
        title: '恢复骑',
        durationMinutes: 30,
        expectedTss: 15,
        intensity: 'easy',
        structure: { mainSet: '轻松踩踏' },
      },
      'change_sport',
      undefined,
      'swimming',
    );

    expect(result.type).toBe('recovery_swim');
    expect(result.intensity).toBe('easy');
    expect(result.structure.mainSet).toContain('呼吸稳定');
  });
});
