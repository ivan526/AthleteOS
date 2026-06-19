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
});
