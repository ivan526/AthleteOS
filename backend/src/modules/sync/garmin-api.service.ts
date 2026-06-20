import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface GarminHrvRecord {
  date: string;
  hrvScore?: number;
  hrvMs?: number;
  status?: string;
  feedbackPhrase?: string;
  baseline?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface GarminActivityRecord {
  id: string;
  name?: string;
  type?: string;
  startTime: string | number;
  durationSeconds?: number;
  distanceMeters?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  normalizedPower?: number;
  avgCadence?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  elevationGain?: number;
  calories?: number;
  tss?: number;
  trainingLoad?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  raw?: Record<string, unknown>;
}

export interface GarminWellnessRecord extends GarminHrvRecord {
  sleepScore?: number;
  sleepSeconds?: number;
  sleepQuality?: number;
  restingHr?: number;
  readiness?: number;
  heartRateRaw?: Record<string, unknown>;
  readinessRaw?: unknown[];
}

export interface GarminSyncResult {
  success: boolean;
  activities: GarminActivityRecord[];
  activityCount: number;
  fetchedDays: number;
  responseDays: number;
  hrvDays: number;
  records: GarminHrvRecord[];
  wellnessRecords: GarminWellnessRecord[];
  error?: string;
  details?: string;
}

@Injectable()
export class GarminApiService {
  private readonly logger = new Logger(GarminApiService.name);

  async getData(params: {
    email: string;
    password: string;
    oldest: Date;
    newest: Date;
    tokenStore: string;
    authDomain: string;
    mfaCode?: string;
  }): Promise<GarminSyncResult> {
    const scriptPath = this.resolveScriptPath();
    const pythonBin = process.env.PYTHON_BIN ?? 'python3';
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GARMIN_EMAIL: params.email,
      GARMIN_PASSWORD: params.password,
      GARMIN_OLDEST: this.toDateId(params.oldest),
      GARMIN_NEWEST: this.toDateId(params.newest),
      GARMIN_TOKENSTORE: params.tokenStore,
      GARMIN_AUTH_DOMAIN: params.authDomain,
    };

    if (params.mfaCode) {
      env.GARMIN_MFA_CODE = params.mfaCode;
    }

    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(pythonBin, [scriptPath], { env });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => rejectPromise(error));
      child.on('close', (code) => {
        const output = stdout.trim();
        try {
          const parsed = JSON.parse(output) as GarminSyncResult;
          if (!parsed.success) {
            this.logger.warn(`Garmin HRV sync failed: ${parsed.error ?? stderr}`);
          }
          resolvePromise(parsed);
        } catch (error) {
          rejectPromise(new Error(`Garmin HRV worker failed (${code}): ${stderr || output || error.message}`));
        }
      });
    });
  }

  private resolveScriptPath(): string {
    const candidates = [
      resolve(process.cwd(), 'scripts/garmin_hrv_sync.py'),
      resolve(process.cwd(), 'backend/scripts/garmin_hrv_sync.py'),
    ];
    const scriptPath = candidates.find((candidate) => existsSync(candidate));
    if (!scriptPath) {
      throw new Error('找不到 Garmin HRV 同步脚本');
    }
    return scriptPath;
  }

  private toDateId(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
