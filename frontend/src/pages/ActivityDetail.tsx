import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Activity as ActivityIcon,
  TrendingUp,
  Heart,
  Footprints,
  Mountain,
  Zap,
  Gauge,
  RefreshCw,
  Brain,
  ShieldAlert,
  BatteryCharging,
  Database,
  Target,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getActivityDetail, type ActivityDetailResponse } from '../lib/api'

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>()
  const [activity, setActivity] = useState<ActivityDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivity = async () => {
      if (!id) return

      try {
        setLoading(true)
        setError(null)
        const data = await getActivityDetail(id)
        setActivity(data)
      } catch (err: any) {
        console.error('加载活动详情失败:', err)
        setError(err.message || '加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [id])

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case '低强度':
        return 'text-status-success bg-green-50'
      case '中等强度':
        return 'text-status-warning bg-orange-50'
      case '高强度':
        return 'text-status-danger bg-red-50'
      default:
        return 'text-text-secondary bg-gray-50'
    }
  }

  const isCycling = activity?.sport === 'cycling'
  const metricGroups = activity
    ? Array.from(new Set(activity.advancedMetrics.map((metric) => metric.group)))
    : []

  if (loading) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/history" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回历史</span>
          </Link>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/history" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回历史</span>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-text-secondary">活动不存在或加载失败</p>
          <Link to="/history" className="btn-primary">
            返回历史列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-page">
      <div className="p-4 pb-20">
        {/* 顶部导航 */}
        <div className="mb-6">
          <Link to="/history" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回历史</span>
          </Link>
        </div>

        {/* 活动头部 */}
        <div className="card mb-4 text-center">
          <div className="text-4xl mb-2">
            {activity.type === '跑步' ? '🏃' : activity.type === '骑行' ? '🚴' : activity.type === '游泳' ? '🏊' : '💪'}
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{activity.name}</h1>
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            <span className={`tag ${getIntensityColor(activity.intensity)}`}>
              {activity.intensity}
            </span>
            <span className="tag flex items-center gap-1">
              <Calendar size={14} />
              {activity.date}
            </span>
            <span className="tag flex items-center gap-1">
              <Clock size={14} />
              {activity.duration}
            </span>
          </div>
          <div className="text-lg font-semibold text-primary mb-1">TSS {activity.tss}</div>
        </div>

        {/* 核心数据 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">
            {isCycling ? '骑行数据' : '数据概览'}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <ActivityIcon size={16} />
                <span className="text-sm">距离</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.distance}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                {isCycling ? <Gauge size={16} /> : <Zap size={16} />}
                <span className="text-sm">{isCycling ? '平均速度' : '平均配速'}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {isCycling
                  ? activity.avgSpeedKmh != null ? `${activity.avgSpeedKmh} km/h` : '-'
                  : activity.avgPace || '-'}
              </p>
              {isCycling && activity.maxSpeedKmh != null && (
                <p className="text-xs text-text-secondary">最高 {activity.maxSpeedKmh} km/h</p>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Heart size={16} />
                <span className="text-sm">平均心率</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.avgHr ? `${activity.avgHr} bpm` : '-'}</p>
              {activity.maxHr && (
                <p className="text-xs text-text-secondary">最高 {activity.maxHr} bpm</p>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                {isCycling ? <RefreshCw size={16} /> : <Footprints size={16} />}
                <span className="text-sm">{isCycling ? '平均踏频' : '平均步频'}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {activity.avgCadence
                  ? `${activity.avgCadence} ${isCycling ? 'rpm' : 'spm'}`
                  : '未记录'}
              </p>
            </div>
            {isCycling && (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                    <Zap size={16} />
                    <span className="text-sm">平均功率</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {activity.avgPower != null ? `${activity.avgPower} W` : '未记录'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                    <TrendingUp size={16} />
                    <span className="text-sm">标准化功率 (NP)</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {activity.normalizedPower != null ? `${activity.normalizedPower} W` : '未记录'}
                  </p>
                  {activity.intensityFactor != null && (
                    <p className="text-xs text-text-secondary">IF {activity.intensityFactor.toFixed(2)}</p>
                  )}
                </div>
              </>
            )}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Mountain size={16} />
                <span className="text-sm">爬升</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.elevationGain || '-'}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <TrendingUp size={16} />
                <span className="text-sm">卡路里</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.calories ? `${activity.calories} kcal` : '-'}</p>
            </div>
          </div>
        </div>

        {isCycling && activity.avgPower == null && (
          <div className="mb-4 rounded-lg border border-border bg-background-weak px-3 py-2 text-sm text-text-secondary">
            本次活动未记录功率计数据，强度评价主要依据心率、速度和训练负荷。
          </div>
        )}

        {activity.advancedMetrics.length > 0 && (
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Gauge size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-text-primary">高级数据</h3>
            </div>
            <div className="space-y-5">
              {metricGroups.map((group) => (
                <section key={group}>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">{group}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activity.advancedMetrics
                      .filter((metric) => metric.group === group)
                      .map((metric) => (
                        <div key={metric.key} className="min-h-20 rounded-lg bg-background-weak p-3">
                          <p className="text-xs text-text-secondary">{metric.label}</p>
                          <p className="mt-1 text-lg font-semibold text-text-primary break-words">
                            {metric.value}
                          </p>
                          {metric.note && (
                            <p className="mt-1 text-xs text-text-muted">{metric.note}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        <div className="card mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Brain size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-text-primary">AI Coach 训练点评</h3>
            </div>
            <span className="shrink-0 rounded bg-background-weak px-2 py-1 text-xs text-primary">
              {activity.coachReview.usedLlm ? 'LLM 增强' : '规则分析'}
            </span>
          </div>
          <p className="text-sm leading-6 text-text-primary">
            {activity.coachReview.summary}
          </p>

          <div className="mt-4 rounded-lg bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-primary">
              <Target size={17} />
              <span className="text-sm font-medium">主要训练效果</span>
            </div>
            <p className="mt-1 text-sm text-text-primary">
              {activity.coachReview.trainingEffect}
            </p>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-text-primary">对你的益处</h4>
            <ul className="mt-2 space-y-2">
              {activity.coachReview.benefits.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <TrendingUp size={16} className="mt-0.5 shrink-0 text-status-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-text-primary">注意点</h4>
            <ul className="mt-2 space-y-2">
              {activity.coachReview.cautions.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-status-warning" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-text-primary">恢复建议</h4>
            <ul className="mt-2 space-y-2">
              {activity.coachReview.recovery.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <BatteryCharging size={16} className="mt-0.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 border-t border-border/60 pt-3 text-xs text-text-muted">
            {activity.coachReview.comparison}
          </p>
        </div>

        {activity.notes && (
          <div className="card mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">备注</h3>
            <p className="text-text-secondary">{activity.notes}</p>
          </div>
        )}

        {/* 数据来源 */}
        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-text-muted">
          <Database size={13} />
          <p>
            数据来源：{activity.dataSources.length ? activity.dataSources.join(' + ') : 'AthleteOS'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ActivityDetail
