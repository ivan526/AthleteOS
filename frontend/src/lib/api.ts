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
  try {
    return await request<TodayResponse>('/today')
  } catch (error) {
    console.warn('API请求失败，使用模拟数据:', error)
    // 返回模拟数据
    return {
      date: new Date().toISOString().split('T')[0],
      training_capacity: {
        score: 76,
        status: 'Train Normally',
        confidence: 0.89,
        data_quality: 'medium',
        confidence_label: '建议可信度较高',
        trend_vs_yesterday: '+4',
      },
      training_risk: {
        level: 'low',
        label: '训练风险较低',
      },
      recommendation: {
        id: 'rec_mock_001',
        sport: 'running',
        type: 'tempo_run',
        title: '节奏跑',
        duration_minutes: 50,
        expected_tss: 65,
        intensity: 'moderate',
        structure: {
          warmup: '轻松跑 10 分钟',
          main_set: '中等偏高强度跑 30 分钟（目标配速+5秒）',
          cooldown: '轻松跑 10 分钟'
        }
      },
      explanation: {
        simple: '今天状态稳定，适合完成计划训练。',
        reasons: [
          '近期训练负荷稳定',
          '当前疲劳处于可接受范围',
          '建议可信度较高'
        ],
        technical: {
          form: -9,
          ctl: 52.3,
          atl: 61.2,
          acwr: 1.12,
          monotony: 1.7,
          sleep_score: null,
          hrv_score: null,
          confidence: 0.89,
          triggered_rules: [],
        },
      },
      feedback_options: [
        'too_tired',
        'not_enough_time',
        'pain_or_discomfort',
        'change_sport',
        'skip_today',
        'completed_as_planned',
      ],
      disclaimer: 'AthleteOS 提供训练建议仅供参考，不构成医疗建议。',
    }
  }
}

/**
 * 提交用户反馈
 */
export async function submitFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
  try {
    return await request<FeedbackResponse>('/today/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.warn('反馈提交API请求失败，使用模拟响应:', error)

    // 根据反馈类型生成模拟调整结果
    let reason = '已根据你的反馈调整训练计划。'
    let newRecommendation: AdjustedRecommendation | undefined

    switch (data.feedback_type) {
      case 'too_tired':
        reason = '你反馈今天比较疲劳，已为你降低训练强度。'
        newRecommendation = {
          id: 'rec_adjusted_001',
          sport: 'running',
          type: 'easy_run',
          title: '轻松跑',
          duration_minutes: 40,
          expected_tss: 35,
          intensity: 'low',
        }
        break
      case 'not_enough_time':
        const duration = data.available_time_minutes || 30
        reason = `已为你调整为${duration}分钟的短时间训练。`
        newRecommendation = {
          id: 'rec_adjusted_002',
          sport: 'running',
          type: 'interval_run',
          title: '间歇跑',
          duration_minutes: duration,
          expected_tss: Math.round(duration * 0.8),
          intensity: 'moderate',
        }
        break
      case 'pain_or_discomfort':
        reason = '你反馈身体有不适，已为你调整为恢复性训练。如有持续疼痛，请咨询专业医生。'
        newRecommendation = {
          id: 'rec_adjusted_003',
          sport: 'running',
          type: 'recovery',
          title: '恢复性慢跑',
          duration_minutes: 30,
          expected_tss: 20,
          intensity: 'low',
        }
        break
      case 'change_sport':
        const sport = data.preferred_sport || 'cycling'
        const sportName = sport === 'cycling' ? '骑行' : sport === 'swimming' ? '游泳' : '力量训练'
        reason = `已为你更换为${sportName}训练。`
        newRecommendation = {
          id: 'rec_adjusted_004',
          sport: sport as any,
          type: sport,
          title: sportName,
          duration_minutes: 50,
          expected_tss: 60,
          intensity: 'moderate',
        }
        break
      case 'skip_today':
        reason = '已记录你今天的休息情况，后续训练计划会相应调整。'
        newRecommendation = undefined
        break
      case 'completed_as_planned':
        reason = '训练完成情况已记录，很棒！'
        newRecommendation = undefined
        break
      default:
        reason = '反馈已提交，感谢你的反馈。'
        newRecommendation = undefined
    }

    return {
      adjusted: !!newRecommendation,
      new_recommendation: newRecommendation,
      reason,
      decision: {
        confidence: 0.9,
        hard_safety_triggered: data.feedback_type === 'pain_or_discomfort',
        adjustment_reason: data.feedback_type,
      },
    }
  }
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

/**
 * 获取同步状态
 */
export function getSyncStatus(): Promise<any> {
  return request('/sync/status')
}
