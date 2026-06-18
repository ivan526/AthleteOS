import { AcwrEngineService } from './acwr-engine.service';

describe('AcwrEngineService', () => {
  it('treats rest days as valid zero load when account history covers 28 days', () => {
    const service = new AcwrEngineService();
    const referenceDate = new Date('2026-06-18T00:00:00.000Z');
    const activities = [
      { startTime: new Date('2026-04-30T08:00:00.000Z'), tss: 40 },
      { startTime: new Date('2026-05-24T08:00:00.000Z'), tss: 180 },
      { startTime: new Date('2026-06-05T08:00:00.000Z'), tss: 54 },
      { startTime: new Date('2026-06-14T08:00:00.000Z'), tss: 54 },
    ] as any;

    const result = service.calculate(activities, referenceDate);

    expect(result.acwr).not.toBeNull();
    expect(result.dataQuality).toBe('high');
    expect(result.confidence).toBe(0.85);
    expect(result.message).toBeUndefined();
  });
});
