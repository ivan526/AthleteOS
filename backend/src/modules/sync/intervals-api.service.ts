import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

// Intervals.icu 活动数据验证 schema
export const IntervalsActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  start_date: z.coerce.date(),
  start_date_local: z.string().optional(),
  moving_time: z.number(), // seconds
  distance: z.number().nullable().optional(), // meters
  tss: z.number().nullable().optional(),
  icu_training_load: z.number().nullable().optional(),
  hr_load: z.number().nullable().optional(),
  intensity_factor: z.number().nullable().optional(),
  icu_intensity: z.number().nullable().optional(),
  avg_hr: z.number().nullable().optional(),
  average_heartrate: z.number().nullable().optional(),
  max_hr: z.number().nullable().optional(),
  max_heartrate: z.number().nullable().optional(),
  avg_power: z.number().nullable().optional(),
  icu_average_watts: z.number().nullable().optional(),
  normalized_power: z.number().nullable().optional(),
  icu_weighted_avg_watts: z.number().nullable().optional(),
  avg_speed: z.number().nullable().optional(), // m/s
  average_speed: z.number().nullable().optional(),
  average_cadence: z.number().nullable().optional(),
  calories: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  total_elevation_gain: z.number().nullable().optional(), // meters
}).passthrough();

export type IntervalsActivity = z.infer<typeof IntervalsActivitySchema>;

export const IntervalsWellnessSchema = z.object({
  id: z.string(),
  ctl: z.number().nullable().optional(),
  atl: z.number().nullable().optional(),
  rampRate: z.number().nullable().optional(),
  ctlLoad: z.number().nullable().optional(),
  atlLoad: z.number().nullable().optional(),
  sleepScore: z.number().nullable().optional(),
  sleepSecs: z.number().nullable().optional(),
  sleepQuality: z.number().nullable().optional(),
  hrv: z.number().nullable().optional(),
  hrvSDNN: z.number().nullable().optional(),
  restingHR: z.number().nullable().optional(),
  readiness: z.number().nullable().optional(),
  fatigue: z.number().nullable().optional(),
  soreness: z.number().nullable().optional(),
  stress: z.number().nullable().optional(),
  mood: z.number().nullable().optional(),
  motivation: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  steps: z.number().nullable().optional(),
}).passthrough();

export type IntervalsWellness = z.infer<typeof IntervalsWellnessSchema>;

@Injectable()
export class IntervalsApiService {
  private readonly logger = new Logger(IntervalsApiService.name);
  private readonly baseUrl: string;
  private readonly apiUser: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('INTERVALS_API_BASE_URL', 'https://intervals.icu/api/v1');
    this.apiUser = this.configService.get<string>('INTERVALS_API_USER', 'API_KEY');
  }

  /**
   * 获取运动员的活动列表
   * @param athleteId Intervals.icu 运动员ID
   * @param apiKey API密钥
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param page 页码
   * @param perPage 每页数量
   */
  async getActivities(
    athleteId: string,
    apiKey: string,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    perPage: number = 100,
  ): Promise<IntervalsActivity[]> {
    try {
      // 手动构建URL参数，确保baseUrl结尾没有斜杠
      const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      let url = `${cleanBaseUrl}/athlete/${athleteId}/activities?page=${page}&per_page=${perPage}`;

      if (startDate) url += `&oldest=${startDate.toISOString().split('T')[0]}`;
      if (endDate) url += `&newest=${endDate.toISOString().split('T')[0]}`;

      // 构建Basic Auth头
      const auth = Buffer.from(`${this.apiUser}:${apiKey}`).toString('base64');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (AthleteOS)',
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Response error: ${response.status} - ${errorText}`);
        throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // 验证并过滤数据
      const activities = data
        .map((item: any) => {
          const result = IntervalsActivitySchema.safeParse(item);
          if (!result.success) {
            this.logger.warn(`Invalid activity data: ${JSON.stringify(result.error.issues)}`);
            return null;
          }
          return result.data;
        })
        .filter(Boolean);

      this.logger.log(`Fetched ${activities.length} valid activities from Intervals.icu`);
      return activities;
    } catch (error) {
      this.logger.error(`Failed to fetch activities: ${error.message}`, error.stack);
      throw new Error(`Intervals.icu API error: ${error.message}`);
    }
  }

  /**
   * 获取运动员信息
   * @param athleteId Intervals.icu 运动员ID
   * @param apiKey API密钥
   */
  async getAthlete(athleteId: string, apiKey: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/athlete/${athleteId}`;
      const auth = Buffer.from(`${this.apiUser}:${apiKey}`).toString('base64');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (AthleteOS)',
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Failed to fetch athlete info: ${error.message}`, error.stack);
      throw new Error(`Intervals.icu API error: ${error.message}`);
    }
  }

  /**
   * 获取健康数据
   * @param athleteId Intervals.icu 运动员ID
   * @param apiKey API密钥
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  async getWellness(
    athleteId: string,
    apiKey: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    try {
      const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      let url = `${cleanBaseUrl}/athlete/${athleteId}/wellness`;
      const params = new URLSearchParams();

      if (startDate) {
        params.append('oldest', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('newest', endDate.toISOString().split('T')[0]);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const auth = Buffer.from(`${this.apiUser}:${apiKey}`).toString('base64');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (AthleteOS)',
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const wellness = data
        .map((item: any) => {
          const result = IntervalsWellnessSchema.safeParse(item);
          if (!result.success) {
            this.logger.warn(`Invalid wellness data: ${JSON.stringify(result.error.issues)}`);
            return null;
          }
          return result.data;
        })
        .filter(Boolean);

      this.logger.log(`Fetched ${wellness.length} valid wellness records from Intervals.icu`);
      return wellness;
    } catch (error) {
      this.logger.error(`Failed to fetch wellness data: ${error.message}`, error.stack);
      throw new Error(`Intervals.icu API error: ${error.message}`);
    }
  }
}
