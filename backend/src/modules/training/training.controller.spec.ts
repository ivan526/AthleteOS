import { TrainingController } from './training.controller';

describe('TrainingController activity presentation', () => {
  const controller = Object.create(TrainingController.prototype) as TrainingController;

  it('uses cycling speed and power fields without exposing running pace', () => {
    const result = (controller as any).toApiActivity({
      id: 'ride-1',
      sport: 'cycling',
      startTime: new Date('2026-06-19T00:00:00.000Z'),
      durationSeconds: 4980,
      distanceMeters: 19839,
      tss: 98,
      intensityFactor: 0.84,
      avgHr: 148,
      maxHr: 179,
      avgPower: null,
      normalizedPower: null,
      avgPace: 251,
      elevationGain: 117,
      rawData: {
        name: 'Morning 骑行',
        average_speed: 4.893,
        max_speed: 10.139,
        calories: 492,
      },
    });

    expect(result.name).toBe('Morning 骑行');
    expect(result.avgPace).toBeUndefined();
    expect(result.avgSpeedKmh).toBe(17.6);
    expect(result.maxSpeedKmh).toBe(36.5);
    expect(result.avgPower).toBeUndefined();
    expect(result.intensityFactor).toBe(0.84);
  });

  it('builds cycling-specific advanced metrics and professional cautions', () => {
    const result = (controller as any).buildActivityAnalysis({
      sport: 'cycling',
      startTime: new Date('2026-06-19T00:00:00.000Z'),
      durationSeconds: 5400,
      distanceMeters: 40000,
      tss: 110,
      intensityFactor: 0.91,
      avgHr: 152,
      maxHr: 181,
      avgPower: 210,
      normalizedPower: 225,
      avgPace: null,
      elevationGain: 380,
      rawData: {
        average_cadence: 86,
        calories: 980,
        aerobicTrainingEffect: 4.2,
        anaerobicTrainingEffect: 2.2,
        providerIds: {
          'garmin.cn': 'g1',
          'intervals.icu': 'i1',
        },
      },
    }, []);

    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'work' }),
      expect.objectContaining({ key: 'variability_index', value: '1.07' }),
      expect.objectContaining({ key: 'power_hr_efficiency' }),
    ]));
    expect(result.cautions.join(' ')).toContain('24–48');
    expect(result.sources).toEqual(['Garmin 中国区', 'Intervals.icu']);
  });

  it('uses running efficiency and running power metrics without cycling work', () => {
    const result = (controller as any).buildActivityAnalysis({
      sport: 'running',
      startTime: new Date('2026-06-20T00:00:00.000Z'),
      durationSeconds: 2400,
      distanceMeters: 6000,
      tss: 45,
      intensityFactor: 0.72,
      avgHr: 150,
      maxHr: 176,
      avgPower: 193,
      normalizedPower: 226,
      avgPace: 400,
      elevationGain: 40,
      rawData: {
        average_cadence: 168,
        providerIds: { 'garmin.cn': 'g2' },
      },
    }, []);

    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pace', value: '6:40/km' }),
      expect.objectContaining({ key: 'speed_hr_efficiency' }),
      expect.objectContaining({ key: 'running_power', value: '193 W' }),
      expect.objectContaining({
        key: 'running_power_variability',
        value: '1.17',
      }),
    ]));
    expect(result.metrics.some((metric: any) => metric.key === 'work')).toBe(false);
    expect(result.benefits[0]).toContain('跑步');
  });

  it('returns the primary and preferred sports as stable today options', () => {
    const options = (controller as any).getSportOptions(
      'cycling',
      ['running', 'cycling', 'swimming', 'unsupported'],
    );

    expect(options).toEqual([
      { sport: 'cycling', label: '骑行' },
      { sport: 'running', label: '跑步' },
      { sport: 'swimming', label: '游泳' },
    ]);
  });

  it('always scopes activity queries to the authenticated user', () => {
    const where = (controller as any).realActivityWhere('user-a', {
      id: 'activity-b',
    });

    expect(where.connectedAccount).toEqual({ userId: 'user-a' });
    expect(where.id).toBe('activity-b');
  });
});
