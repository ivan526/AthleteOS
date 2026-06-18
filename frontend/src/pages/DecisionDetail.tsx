import { useState, useEffect } from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getModelDataCoverage,
  getTodayData,
  type ModelDataCoverage,
  type TodayResponse,
} from '../lib/api'

const DecisionDetail = () => {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [coverage, setCoverage] = useState<ModelDataCoverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [todayResult, coverageResult] = await Promise.all([
        getTodayData(),
        getModelDataCoverage(),
      ])
      setData(todayResult)
      setCoverage(coverageResult)
    } catch (err: any) {
      setError(err.message || '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回</span>
          </Link>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回</span>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-text-secondary">{error || '数据加载失败'}</p>
          <button className="btn-primary" onClick={fetchData}>
            重新加载
          </button>
        </div>
      </div>
    )
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

  const confidence = data.explanation.technical.confidence || 0
  const coverageByKey = new Map(coverage?.available.map((item) => [item.key, item]) ?? [])
  const sleepDays = coverageByKey.get('sleep')?.count ?? 0
  const hrvDays = coverageByKey.get('hrv')?.count ?? 0
  const confidencePercent = Math.round(confidence * 100)
  const getConfidenceLevel = (percent: number) => {
    if (percent >= 80) return '很高'
    if (percent >= 60) return '较高'
    if (percent >= 40) return '中等'
    return '较低'
  }

  return (
    <div className="min-h-screen bg-background-page p-4 pb-20">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft size={20} />
          <span>返回今日训练</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">决策依据</h1>
        <p className="text-text-secondary">查看训练建议的专业计算依据</p>
      </div>

      {/* 建议可信度 */}
      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-text-primary mb-3">建议可信度</h3>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">{confidencePercent}%</span>
          </div>
          <div>
            <p className="text-xl font-semibold text-text-primary">{getConfidenceLevel(confidencePercent)}</p>
            <p className="text-sm text-text-secondary">
              {confidencePercent >= 80
                ? '数据充足，建议可信度很高'
                : confidencePercent >= 60
                ? '数据较充足，建议可信度较高'
                : confidencePercent >= 40
                ? '数据基本充足，建议供参考'
                : '数据较少，建议偏保守'}
            </p>
          </div>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-text-primary mb-3">关键指标</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">CTL (长期负荷)</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.ctl?.toFixed(1) || '-'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">ATL (短期负荷)</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.atl?.toFixed(1) || '-'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">Form (状态)</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.form?.toFixed(1) || '-'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">ACWR (负荷比)</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.acwr?.toFixed(2) || '-'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">Monotony (训练单调性)</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.monotony?.toFixed(2) || '-'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">睡眠评分</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.sleep_score ?? '今日无数据'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">HRV评分</p>
            <p className="text-lg font-semibold text-text-primary">{data.explanation.technical.hrv_score ?? '今日无数据'}</p>
          </div>
          <div className="p-3 bg-background-weak rounded-lg">
            <p className="text-xs text-text-secondary mb-1">训练风险</p>
            <p className={`text-lg font-semibold ${getRiskColor(data.training_risk.level)}`}>
              {getRiskText(data.training_risk.level)}
            </p>
          </div>
        </div>
      </div>

      {/* 数据质量 */}
      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-text-primary mb-3">数据质量</h3>
        <div className="p-3 bg-background-weak rounded-lg mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-text-primary">数据质量等级</span>
            <span className="tag">Level {coverage?.dataLevel ?? '-'}</span>
          </div>
          <p className="text-sm text-text-secondary mb-2">
            已覆盖 {coverage?.historyDays ?? 0} 天训练历史
          </p>
          <p className="text-sm text-text-secondary">
            {coverage?.confidenceNote ?? '正在读取模型数据覆盖情况。'}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">训练记录</span>
            <span className="text-sm text-status-success">
              已接入 {coverageByKey.get('activities')?.count ?? 0} 条
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">TSS / CTL / ATL</span>
            <span className="text-sm text-status-success">
              已接入 {coverageByKey.get('ctl_atl_form')?.count ?? 0} 天
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Form / Fitness</span>
            <span className="text-sm text-status-success">已完成</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">配速 / 功率 / 心率</span>
            <span className="text-sm text-status-success">已完成</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">睡眠 / HRV</span>
            <span className={sleepDays > 0 || hrvDays > 0 ? 'text-sm text-status-success' : 'text-sm text-text-secondary'}>
              睡眠 {sleepDays} 天 · HRV {hrvDays} 天
            </span>
          </div>
        </div>
      </div>

      {/* 触发规则 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-3">安全规则触发情况</h3>
        {data.explanation.technical.triggered_rules && data.explanation.technical.triggered_rules.length > 0 ? (
          <div className="space-y-3">
            {data.explanation.technical.triggered_rules.map((rule, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-status-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-status-danger">{rule.rule}</p>
                    <p className="text-sm text-status-danger/80">{rule.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-sm text-status-success">未触发硬性安全规则，当前建议可正常执行。</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DecisionDetail
