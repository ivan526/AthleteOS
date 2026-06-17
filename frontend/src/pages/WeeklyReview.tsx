import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Trophy, AlertTriangle, Bot } from 'lucide-react'
import Layout from '../components/Layout'
import { getWeeklyReview, type WeeklyReview as WeeklyReviewType } from '../lib/api'

const WeeklyReview = () => {
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState<WeeklyReviewType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWeeklyData = async () => {
      try {
        setLoading(true)
        setError(null)
        const weeklyData = await getWeeklyReview(weekOffset)
        setData(weeklyData)
      } catch (err: any) {
        console.error('加载周复盘数据失败:', err)
        setError(err.message || '加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyData()
  }, [weekOffset])

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${startDate.getMonth() + 1}月${startDate.getDate()}日 - ${endDate.getMonth() + 1}月${endDate.getDate()}日`
  }

  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return '训练风险较低'
      case 'moderate': return '训练风险略有上升'
      case 'elevated': return '训练风险偏高'
      case 'high_caution': return '建议恢复优先'
      default: return '训练风险较低'
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-status-success'
      case 'moderate': return 'text-status-warning'
      case 'elevated':
      case 'high_caution':
        return 'text-status-danger'
      default:
        return 'text-text-secondary'
    }
  }

  const getChangeText = (change: number) => {
    if (change > 0) return `+${Math.round(change * 100)}%`
    if (change < 0) return `${Math.round(change * 100)}%`
    return '0%'
  }

  const getChangeColor = (change: number) => {
    if (change > 0.1) return 'text-status-danger'
    if (change < -0.1) return 'text-status-success'
    return 'text-text-secondary'
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-1">每周复盘</h1>
            <p className="text-text-secondary">总结训练效果，优化后续计划</p>
          </div>
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-text-secondary">加载中...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-1">每周复盘</h1>
            <p className="text-text-secondary">总结训练效果，优化后续计划</p>
          </div>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <p className="text-text-secondary">{error || '数据加载失败'}</p>
            <button className="btn-primary" onClick={() => setWeekOffset(weekOffset)}>
              重新加载
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">每周复盘</h1>
          <p className="text-text-secondary">总结训练效果，优化后续计划</p>
        </div>

        {/* 周选择器 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 hover:bg-background-weak rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-text-primary" />
          </button>
          <h3 className="text-lg font-semibold text-text-primary">
            {weekOffset === 0 ? '本周' : weekOffset === 1 ? '上周' : `${weekOffset}周前`} · {formatDateRange(data.weekStart, data.weekEnd)}
          </h3>
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 hover:bg-background-weak rounded-lg transition-colors"
            disabled={weekOffset <= 0}
          >
            <ChevronRight size={20} className={`text-text-primary ${weekOffset <= 0 ? 'opacity-30' : ''}`} />
          </button>
        </div>

        {/* 周总结卡片 */}
        <div className="card mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Trophy size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">周总结</h3>
              <p className="text-text-secondary">{data.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">周总 TSS</p>
              <p className="text-2xl font-bold text-text-primary">{data.weeklyTss}</p>
              <p className={`text-xs ${getChangeColor(data.loadChangeVsLastWeek)}`}>
                {getChangeText(data.loadChangeVsLastWeek)} 较上周
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">训练完成率</p>
              <p className="text-2xl font-bold text-text-primary">{Math.round(data.adherence * 100)}%</p>
              <p className="text-xs text-text-secondary">
                完成 {Math.round(data.adherence * 7)}/7 次训练
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">训练风险</p>
              <p className={`text-2xl font-bold ${getRiskColor(data.trainingRiskLevel)}`}>
                {getRiskText(data.trainingRiskLevel)}
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">周负荷变化</p>
              <p className={`text-2xl font-bold ${getChangeColor(data.loadChangeVsLastWeek)}`}>
                {getChangeText(data.loadChangeVsLastWeek)}
              </p>
              <p className="text-xs text-text-secondary">
                {Math.abs(data.loadChangeVsLastWeek) < 0.1 ? '负荷稳定' : data.loadChangeVsLastWeek > 0 ? '负荷上升' : '负荷下降'}
              </p>
            </div>
          </div>
        </div>

        {data.aiCoachSummary && (
          <div className="card mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={20} className="text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-text-primary">AI Coach 分析</h3>
                  <span className="text-xs text-text-secondary">
                    {data.aiCoach?.usedLlm ? 'LLM 增强' : '规则总结'}
                  </span>
                </div>
                <p className="text-text-secondary">{data.aiCoachSummary}</p>
              </div>
            </div>
          </div>
        )}

        {/* 每日TSS分布 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">每日训练负荷</h3>
          <div className="space-y-2">
            {data.dailyStats.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{day.date}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (day.tss / 150) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-text-primary w-10 text-right">
                    {day.tss}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 亮点 */}
        {data.highlights.length > 0 && (
          <div className="card mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-3">本周亮点</h3>
            <div className="space-y-2">
              {data.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 text-status-success flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p className="text-text-secondary">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 改进建议 */}
        {data.warnings.length > 0 && (
          <div className="card">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={20} className="text-status-warning mt-0.5 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-text-primary">改进建议</h3>
            </div>
            <div className="space-y-2">
              {data.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-yellow-100 text-status-warning flex items-center justify-center flex-shrink-0 mt-0.5">
                    !
                  </div>
                  <p className="text-text-secondary">{warning}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default WeeklyReview
