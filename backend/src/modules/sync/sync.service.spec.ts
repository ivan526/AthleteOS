import { SyncService } from './sync.service';

describe('SyncService daily sync', () => {
  const prisma = {
    connectedAccount: {
      findUnique: jest.fn(),
    },
  };
  let service: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyncService(
      prisma as any,
      {} as any,
      {} as any,
      {
        decrypt: (value: string) => value,
        encrypt: (value: string) => value,
        isConfigured: Boolean,
      } as any,
    );
  });

  it('skips sources already synchronized today', async () => {
    const today = new Date();
    prisma.connectedAccount.findUnique
      .mockResolvedValueOnce({
        athleteId: 'i123',
        apiKey: 'intervals-key',
        lastSyncAt: today,
      })
      .mockResolvedValueOnce({
        athleteId: 'runner@example.com',
        apiKey: 'garmin-password',
        lastSyncAt: today,
      });
    const intervalsSpy = jest.spyOn(service, 'syncIntervalsData');
    const garminSpy = jest.spyOn(service, 'syncGarminHrvData');

    const result = await service.syncDailyData('user-1');

    expect(result.success).toBe(true);
    expect(result.intervals.attempted).toBe(false);
    expect(result.garmin.attempted).toBe(false);
    expect(intervalsSpy).not.toHaveBeenCalled();
    expect(garminSpy).not.toHaveBeenCalled();
  });

  it('runs incremental synchronization when the last sync was before today', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    prisma.connectedAccount.findUnique
      .mockResolvedValueOnce({
        athleteId: 'i123',
        apiKey: 'intervals-key',
        lastSyncAt: yesterday,
      })
      .mockResolvedValueOnce({
        athleteId: 'runner@example.com',
        apiKey: 'garmin-password',
        lastSyncAt: yesterday,
      });
    const intervalsSpy = jest
      .spyOn(service, 'syncIntervalsData')
      .mockResolvedValue({
        success: true,
        syncedActivities: 2,
        newActivities: 1,
        updatedActivities: 1,
      });
    const garminSpy = jest
      .spyOn(service, 'syncGarminHrvData')
      .mockResolvedValue({
        success: true,
        fetchedDays: 8,
        syncedHrvDays: 1,
        skippedExistingHrvDays: 7,
      });

    const result = await service.syncDailyData('user-1');

    expect(result.success).toBe(true);
    expect(result.intervals.attempted).toBe(true);
    expect(result.garmin.attempted).toBe(true);
    expect(intervalsSpy).toHaveBeenCalledWith('user-1', false);
    expect(garminSpy).toHaveBeenCalledWith('user-1', false);
  });

  it('keeps a Garmin run and an Intervals ride on the same day as separate activities', () => {
    const run = {
      sport: 'running',
      startTime: new Date('2026-06-20T00:00:00.000Z'),
      durationSeconds: 3600,
      distanceMeters: 10000,
    };
    const ride = {
      sport: 'cycling',
      startTime: new Date('2026-06-20T00:05:00.000Z'),
      durationSeconds: 3600,
      distanceMeters: 20000,
    };

    expect((service as any).activitiesMatch(run, ride)).toBe(false);
  });

  it('merges the same activity when time, duration and distance are close', () => {
    const garminRun = {
      sport: 'running',
      startTime: new Date('2026-06-20T00:00:00.000Z'),
      durationSeconds: 3600,
      distanceMeters: 10000,
    };
    const intervalsRun = {
      sport: 'running',
      startTime: new Date('2026-06-20T00:04:00.000Z'),
      durationSeconds: 3540,
      distanceMeters: 10100,
    };

    expect((service as any).activitiesMatch(garminRun, intervalsRun)).toBe(true);
  });

  it('merges near-identical GPS activities even when moving-time definitions differ', () => {
    const garminRide = {
      sport: 'cycling',
      startTime: new Date('2026-06-19T00:22:59.000Z'),
      durationSeconds: 3922,
      distanceMeters: 20094,
    };
    const intervalsRide = {
      sport: 'cycling',
      startTime: new Date('2026-06-19T00:22:57.000Z'),
      durationSeconds: 4980,
      distanceMeters: 19839,
    };

    expect((service as any).activitiesMatch(garminRide, intervalsRide)).toBe(true);
  });
});
