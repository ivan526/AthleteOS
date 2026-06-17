/**
 * API 请求工具
 */

const API_BASE_URL = '/api'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TrainingCapacity {
  score: number
  status: string
  confidence: number
  data_quality: string
  confidence_label: string
  trend_vs_yesterday: string
}

export interface TrainingRisk {
  level: string
  label: string
}

export interface WorkoutStructure {
  warmup?: string
  main_set: string
  cooldown?: string
}

export interface WorkoutRecommendation {
  id: string
  sport: string
  type: string
  title: string
  duration_minutes: number
  expected_tss: number
  intensity: string
  structure: WorkoutStructure
}

export interface Explanation {
  simple: string
  reasons: string[]
  technical: {
    form: number
    ctl?: number
    atl?: number
    acwr: number
    monotony: number
    sleep_score: number | null
    hrv_score: number | null
    confidence: number
    triggered_rules: Array<{
      rule: string
      condition: string
      value: string | number
      action: string
    }>
  }
}

export interface TodayResponse {
  date: string
  training_capacity: TrainingCapacity
  training_risk: TrainingRisk
  recommendation: WorkoutRecommendation
  explanation: Explanation
  feedback_options: string[]
  disclaimer: string
}

export interface FeedbackRequest {
  recommendation_id: string
  feedback_type: string
  subjective_fatigue?: number
  pain?: boolean
  available_time_minutes?: number
  preferred_sport?: string
  note?: string
}

export interface AdjustedRecommendation {
  id: string
  sport: string
  type: string
  title: string
  duration_minutes: number
  expected_tss: number
  intensity: string
}

export interface FeedbackResponse {
  adjusted: boolean
  new_recommendation?: AdjustedRecommendation
  reason: string
  decision: {
    confidence: number
    hard_safety_triggered: boolean
    adjustment_reason: string
  }
}

/**
 * 通用请求方法
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const defaultHeaders = {
    'Content-Type': 'application/json',
  }

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || data.message || '请求失败')
    }

    return data
  } catch (error) {
    console.error('API 请求错误:', error)
    throw error
  }
}

/**
 * 获取今日训练数据
 */
export async function getTodayData(): Promise<TodayResponse> {
  return await request<TodayResponse>('/today')
}

/**
 * 提交用户反馈
 */
export async function submitFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
  return await request<FeedbackResponse>('/today/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 触发同步Intervals.icu数据
 */
export function syncIntervals(fullSync: boolean = false): Promise<any> {
  return request('/sync/intervals', {
    method: 'POST',
    body: JSON.stringify({ fullSync }),
  })
}

export function syncGarmin(fullSync: boolean = false, mfaCode?: string): Promise<any> {
  return request('/sync/garmin', {
    method: 'POST',
    body: JSON.stringify({ fullSync, mfa_code: mfaCode }),
  })
}

/**
 * 获取同步状态
 */
export function getSyncStatus(): Promise<any> {
  return request('/sync/status')
}

export interface UserSettings {
  intervals_athlete_id: string
  has_credentials: boolean
  last_sync_at: string | null
  garmin_email: string
  has_garmin_credentials: boolean
  garmin_last_sync_at: string | null
  garmin_sync_status: string
  garmin_sync_message: string
  llm_provider: string
  llm_model: string
  llm_base_url: string
  llm_enabled: boolean
  has_llm_api_key: boolean
  primary_sport: string
  weekly_available_days: number
  preferred_sports: string[]
  primary_goal: string
  goal_date: string
  goal_time: number
}

export function getSettings(): Promise<UserSettings> {
  return request<UserSettings>('/settings')
}

export function updateSettings(data: {
  intervals_api_key?: string
  intervals_athlete_id?: string
  garmin_email?: string
  garmin_password?: string
  llm_provider?: string
  llm_model?: string
  llm_base_url?: string
  llm_api_key?: string
  llm_enabled?: boolean
  primary_sport?: string
  weekly_available_days?: number
}): Promise<UserSettings> {
  return request<UserSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * 获取历史活动列表
 */
export interface Activity {
  id: string
  date: string
  type: string
  sport?: string
  name: string
  duration: string
  distance: string
  tss: number
  intensity: string
  avgPace?: string
  avgHr?: number
  maxHr?: number
  avgCadence?: number
  elevationGain?: string
  calories?: number
  notes?: string
}

export function getActivities(page: number = 1, limit: number = 30): Promise<Activity[]> {
  return request<Activity[]>(`/activities?page=${page}&limit=${limit}`)
}

/**
 * 获取活动详情
 */
export function getActivityDetail(id: string): Promise<Activity> {
  return request<Activity>(`/activities/${id}`)
}

export interface HistorySummary {
  weekStart: string
  weekEnd: string
  weeklyTss: number
  loadChangeVsLastWeek: number
  trainingDays: number
  plannedDays: number
  adherence: number
  averageIntensity: string
  trainingRiskLevel: 'low' | 'moderate' | 'elevated' | 'high_caution'
  fourWeekTrend: Array<{
    week: string
    tss: number
    change: string
  }>
}

export function getHistorySummary(): Promise<HistorySummary> {
  return request<HistorySummary>('/history/summary')
}

export interface ModelDataCoverage {
  dataLevel: 'A' | 'B' | 'C' | 'D'
  historyDays: number
  available: Array<{ key: string; label: string; count: number; source: string }>
  missing: string[]
  confidenceNote: string
}

export function getModelDataCoverage(): Promise<ModelDataCoverage> {
  return request<ModelDataCoverage>('/model/data-coverage')
}

export interface WellnessHistoryItem {
  date: string
  source: string
  sleep_score: number | null
  sleep_seconds: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  hrv_score: number | null
  hrv_ms: number | null
  hrv_sdnn_ms: number | null
  resting_hr: number | null
  readiness: number | null
  fatigue: number | null
  soreness: number | null
  stress: number | null
  mood: number | null
  motivation: number | null
  weight_kg: number | null
  steps: number | null
}

export function getWellnessHistory(days: number = 30): Promise<WellnessHistoryItem[]> {
  return request<WellnessHistoryItem[]>(`/wellness/history?days=${days}`)
}

/**
 * 获取周复盘数据
 */
export interface WeeklyReview {
  weekStart: string
  weekEnd: string
  summary: string
  adherence: number
  weeklyTss: number
  loadChangeVsLastWeek: number
  trainingRiskLevel: 'low' | 'moderate' | 'elevated' | 'high_caution'
  highlights: string[]
  warnings: string[]
  dailyStats: Array<{
    date: string
    tss: number
    type: string
  }>
}

export function getWeeklyReview(weekOffset: number = 0): Promise<WeeklyReview> {
  return request<WeeklyReview>(`/weekly-review?weekOffset=${weekOffset}`)
}
