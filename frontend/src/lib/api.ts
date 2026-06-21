/**
 * API 请求工具
 */

const API_BASE_URL = '/api'
const REMEMBER_SESSION_KEY = 'athleteos_remember_session'
const ACCESS_TOKEN_KEY = 'athleteos_access_token'
let rememberSession = localStorage.getItem(REMEMBER_SESSION_KEY) !== 'false'
let accessToken =
  localStorage.getItem(ACCESS_TOKEN_KEY) ??
  sessionStorage.getItem(ACCESS_TOKEN_KEY)
let refreshPromise: Promise<string | null> | null = null

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
  ai_coach?: {
    used_llm: boolean
    safety_filtered: boolean
    fallback_used: boolean
  }
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
  sport_options: Array<{
    sport: string
    label: string
  }>
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
  pain_area?: string
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
  retryAuth = true,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const defaultHeaders = {
    'Content-Type': 'application/json',
  }

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (
        response.status === 401 &&
        retryAuth &&
        !endpoint.startsWith('/auth/')
      ) {
        const refreshed = await refreshAccessToken()
        if (refreshed) return request<T>(endpoint, options, false)
      }
      throw new Error(data.error || data.message || '请求失败')
    }

    return data
  } catch (error) {
    console.error('API 请求错误:', error)
    throw error
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  status: string
}

export interface AuthResponse {
  access_token: string
  user: AuthUser
}

function storeAccessToken(token: string | null) {
  accessToken = token
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  if (token) {
    const storage = rememberSession ? localStorage : sessionStorage
    storage.setItem(ACCESS_TOKEN_KEY, token)
  }
}

function setRememberSession(remember: boolean) {
  rememberSession = remember
  localStorage.setItem(REMEMBER_SESSION_KEY, String(remember))
}

export async function registerUser(data: {
  email: string
  password: string
  name?: string
  remember_me?: boolean
}): Promise<AuthResponse> {
  setRememberSession(data.remember_me !== false)
  const result = await request<AuthResponse>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(data) },
    false,
  )
  storeAccessToken(result.access_token)
  return result
}

export async function loginUser(data: {
  email: string
  password: string
  remember_me?: boolean
}): Promise<AuthResponse> {
  setRememberSession(data.remember_me !== false)
  const result = await request<AuthResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(data) },
    false,
  )
  storeAccessToken(result.access_token)
  return result
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remember_me: rememberSession }),
  })
    .then(async (response) => {
      if (!response.ok) return null
      const result = (await response.json()) as AuthResponse
      storeAccessToken(result.access_token)
      return result.access_token
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me')
}

export async function logoutUser(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST', body: '{}' }, false)
  } finally {
    storeAccessToken(null)
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

export interface FeedbackHistoryItem {
  id: string
  created_at: string
  date: string
  feedback_type: string
  subjective_fatigue: number | null
  pain: boolean
  pain_area: string | null
  available_time_minutes: number | null
  preferred_sport: string | null
  note: string | null
  recommendation: {
    title: string
    type: string
    duration_minutes: number
    expected_tss: number
    status: string
  }
}

export function getFeedbackHistory(limit: number = 20): Promise<FeedbackHistoryItem[]> {
  return request<FeedbackHistoryItem[]>(`/feedback?limit=${limit}`)
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

export function syncDaily(): Promise<any> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  return request('/sync/daily', {
    method: 'POST',
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeout)
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
  garmin_auth_domain: string
  has_garmin_credentials: boolean
  garmin_last_sync_at: string | null
  garmin_sync_status: string
  garmin_sync_message: string
  primary_data_source: string
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
  garmin_auth_domain?: string
  llm_provider?: string
  llm_model?: string
  llm_base_url?: string
  llm_api_key?: string
  llm_enabled?: boolean
  primary_sport?: string
  weekly_available_days?: number
  preferred_sports?: string[]
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
  avgSpeedKmh?: number
  maxSpeedKmh?: number
  avgHr?: number
  maxHr?: number
  avgCadence?: number
  avgPower?: number
  normalizedPower?: number
  intensityFactor?: number
  elevationGain?: string
  calories?: number
  notes?: string
}

export interface AdvancedActivityMetric {
  key: string
  group: string
  label: string
  value: string
  note?: string
}

export interface ActivityCoachReview {
  summary: string
  trainingEffect: string
  benefits: string[]
  cautions: string[]
  recovery: string[]
  comparison: string
  dataQuality: 'high' | 'medium' | 'limited'
  usedLlm: boolean
  safetyFiltered: boolean
  fallbackUsed: boolean
}

export interface ActivityDetailResponse extends Activity {
  advancedMetrics: AdvancedActivityMetric[]
  dataSources: string[]
  coachReview: ActivityCoachReview
}

export function getActivities(page: number = 1, limit: number = 30): Promise<Activity[]> {
  return request<Activity[]>(`/activities?page=${page}&limit=${limit}`)
}

/**
 * 获取活动详情
 */
export function getActivityDetail(id: string): Promise<ActivityDetailResponse> {
  return request<ActivityDetailResponse>(`/activities/${id}`)
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

export interface AiCoachAnswer {
  answer: string
  used_llm: boolean
  safety_filtered: boolean
  fallback_used: boolean
}

export function askAiCoach(question: string, pain: boolean = false): Promise<AiCoachAnswer> {
  return request<AiCoachAnswer>('/ai-coach/ask', {
    method: 'POST',
    body: JSON.stringify({ question, pain }),
  })
}

export interface AiCoachAudit {
  id: string
  interactionType: string
  provider: string | null
  model: string | null
  inputEvidence: Record<string, unknown>
  ruleResult: Record<string, unknown> | null
  rawOutput: string | null
  finalOutput: string
  guardrailReasons: string[] | null
  safetyFiltered: boolean
  fallbackUsed: boolean
  errorMessage: string | null
  createdAt: string
}

export function getAiCoachAudits(limit: number = 20): Promise<AiCoachAudit[]> {
  return request<AiCoachAudit[]>(`/ai-coach/audits?limit=${limit}`)
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
  nextWeekRecommendation: string
  aiCoachSummary?: string
  aiCoach?: {
    usedLlm: boolean
    safetyFiltered: boolean
    fallbackUsed: boolean
  }
  modelCoverage?: {
    activityCount: number
    dailyStateDays: number
    sleepDays: number
    hrvDays: number
    hasCtlAtl: boolean
  }
  recoveryTrend?: {
    averageSleepScore: number | null
    averageRestingHr: number | null
    hrvDataPoints: number
    hrvDirection: 'up' | 'down' | 'stable' | 'insufficient'
    sleepDirection: 'up' | 'down' | 'stable' | 'insufficient'
  }
  dailyStats: Array<{
    date: string
    tss: number
    type: string
  }>
}

export function getWeeklyReview(weekOffset: number = 0): Promise<WeeklyReview> {
  return request<WeeklyReview>(`/weekly-review?weekOffset=${weekOffset}`)
}
