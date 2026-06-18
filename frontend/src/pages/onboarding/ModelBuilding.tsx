import { useState, useEffect } from 'react'
import { Check, Clock, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getModelDataCoverage, type ModelDataCoverage } from '../../lib/api'

const ModelBuilding = () => {
  const navigate = useNavigate()
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStatus, setSyncStatus] = useState({
    activities: 'syncing', // syncing | completed | failed
    metrics: 'syncing',
    fitness: 'syncing',
    performance: 'syncing',
    wellness: 'pending',
  })
  const [syncCompleted, setSyncCompleted] = useState(false)
  const [coverage, setCoverage] = useState<ModelDataCoverage | null>(null)

  useEffect(() => {
    getModelDataCoverage()
      .then((result) => {
        const available = new Map(result.available.map((item) => [item.key, item.count]))
        const hasActivities = (available.get('activities') ?? 0) > 0
        const hasMetrics = (available.get('ctl_atl_form') ?? 0) > 0
        const hasWellness = (available.get('sleep') ?? 0) > 0 || (available.get('hrv') ?? 0) > 0
        setCoverage(result)
        setSyncStatus({
          activities: hasActivities ? 'completed' : 'failed',
          metrics: hasMetrics ? 'completed' : 'failed',
          fitness: hasMetrics ? 'completed' : 'failed',
          performance: hasActivities ? 'completed' : 'failed',
          wellness: hasWellness ? 'completed' : 'failed',
        })
        setSyncProgress(100)
        setSyncCompleted(true)
      })
      .catch(() => {
        setSyncStatus({
          activities: 'failed',
          metrics: 'failed',
          fitness: 'failed',
          performance: 'failed',
          wellness: 'failed',
        })
        setSyncCompleted(true)
      })
  }, [])

  const handleEnter = () => {
    navigate('/today')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check size={18} className="text-status-success" />
      case 'syncing':
        return <Clock size={18} className="text-text-secondary animate-pulse" />
      case 'pending':
        return <Clock size={18} className="text-text-secondary/50" />
      default:
        return <Clock size={18} className="text-text-secondary/50" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'syncing':
        return '同步中...'
      case 'pending':
        return '等待中'
      case 'failed':
        return '暂无数据'
      default:
        return '等待中'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-status-success'
      case 'syncing':
        return 'text-text-secondary'
      case 'pending':
        return 'text-text-secondary/50'
      default:
        return 'text-text-secondary/50'
    }
  }

  return (
    <div className="min-h-screen bg-background-page p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-background-weak rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={40} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">建立运动员模型</h1>
          <p className="text-text-secondary max-w-sm mx-auto">
            正在汇总 Intervals.icu 与已配置补充数据源
          </p>
        </div>

        {/* 同步进度条 */}
        <div className="mb-8">
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-text-secondary text-center">{syncProgress}%</p>
        </div>

        {/* 同步状态 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">模型数据状态</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.activities)}
                <span className="text-text-primary">训练记录</span>
              </div>
              <span className={`text-sm ${getStatusColor(syncStatus.activities)}`}>
                {getStatusText(syncStatus.activities)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.metrics)}
                <span className="text-text-primary">TSS / CTL / ATL</span>
              </div>
              <span className={`text-sm ${getStatusColor(syncStatus.metrics)}`}>
                {getStatusText(syncStatus.metrics)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.fitness)}
                <span className="text-text-primary">Form / Fitness</span>
              </div>
              <span className={`text-sm ${getStatusColor(syncStatus.fitness)}`}>
                {getStatusText(syncStatus.fitness)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.performance)}
                <span className="text-text-primary">配速 / 功率 / 心率</span>
              </div>
              <span className={`text-sm ${getStatusColor(syncStatus.performance)}`}>
                {getStatusText(syncStatus.performance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.wellness)}
                <span className="text-text-primary">睡眠 / HRV</span>
              </div>
              <span className={`text-sm ${getStatusColor(syncStatus.wellness)}`}>
                {syncStatus.wellness === 'completed'
                  ? `睡眠 ${coverage?.available.find((item) => item.key === 'sleep')?.count ?? 0} 天 · HRV ${coverage?.available.find((item) => item.key === 'hrv')?.count ?? 0} 天`
                  : getStatusText(syncStatus.wellness)}
              </span>
            </div>
          </div>
        </div>

        {syncCompleted && (
          <>
            {/* 数据充足度 */}
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">数据充足度</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{coverage?.dataLevel ?? '-'}</span>
                </div>
                <div>
                  <p className="text-xl font-semibold text-text-primary">Level {coverage?.dataLevel ?? '-'}</p>
                  <p className="text-sm text-text-secondary">已覆盖 {coverage?.historyDays ?? 0} 天训练历史</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                {coverage?.confidenceNote ?? '模型会根据当前可用数据调整建议可信度。'}
              </p>
            </div>

            {/* 当前建议策略 */}
            <div className="card mb-8">
              <h3 className="text-lg font-semibold text-text-primary mb-3">当前建议策略</h3>
              <p className="text-sm text-text-secondary">
                系统会先给出偏保守建议，避免过度训练。随着训练数据积累，系统会更准确地理解你的状态与能力。
              </p>
            </div>

            {/* 进入按钮 */}
            <button
              className="btn-primary w-full"
              onClick={handleEnter}
            >
              进入今日训练
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ModelBuilding
