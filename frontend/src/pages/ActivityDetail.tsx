import { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, Clock, Activity, TrendingUp, Heart, Footprints, Mountain, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

// 模拟活动详情数据
const mockActivity = {
  id: '1',
  date: '2026-06-14',
  type: '跑步',
  name: '节奏跑',
  duration: '50 分钟',
  distance: '10.2 公里',
  tss: 65,
  intensity: '中等强度',
  avgPace: '4:54 /km',
  avgHr: 152,
  maxHr: 178,
  avgCadence: 178,
  elevationGain: '52 米',
  calories: 580,
  feeling: '不错',
  notes: '今天状态很好，配速稳定，最后一公里还能加速。',
  splits: [
    { km: '1', pace: '4:58', hr: 145 },
    { km: '2', pace: '4:55', hr: 148 },
    { km: '3', pace: '4:52', hr: 151 },
    { km: '4', pace: '4:56', hr: 153 },
    { km: '5', pace: '4:53', hr: 154 },
    { km: '6', pace: '4:51', hr: 156 },
    { km: '7', pace: '4:57', hr: 152 },
    { km: '8', pace: '4:54', hr: 155 },
    { km: '9', pace: '4:50', hr: 158 },
    { km: '10', pace: '4:38', hr: 165 },
    { km: '0.2', pace: '2:15', hr: 150 },
  ]
}

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>()
  const [activity, setActivity] = useState(mockActivity)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setActivity(mockActivity)
      setLoading(false)
    }, 500)
  }, [id])

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
          <h3 className="text-lg font-semibold text-text-primary mb-3">数据概览</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Activity size={16} />
                <span className="text-sm">距离</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.distance}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Zap size={16} />
                <span className="text-sm">平均配速</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.avgPace}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Heart size={16} />
                <span className="text-sm">平均心率</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.avgHr} bpm</p>
              <p className="text-xs text-text-secondary">最高 {activity.maxHr} bpm</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Footprints size={16} />
                <span className="text-sm">平均步频</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.avgCadence} spm</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <Mountain size={16} />
                <span className="text-sm">爬升</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.elevationGain}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-text-secondary">
                <TrendingUp size={16} />
                <span className="text-sm">卡路里</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{activity.calories} kcal</p>
            </div>
          </div>
        </div>

        {/* 分段数据 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">分段数据</h3>
          <div className="space-y-2">
            {activity.splits.map((split, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                <div className="font-medium text-text-primary">第 {split.km} 公里</div>
                <div className="flex items-center gap-4">
                  <span className="text-text-secondary">{split.pace}</span>
                  <span className="text-text-secondary w-12 text-right">{split.hr} bpm</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 自我感受 */}
        {activity.feeling && (
          <div className="card mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">自我感受</h3>
            <p className="text-text-secondary">{activity.feeling}</p>
          </div>
        )}

        {/* 备注 */}
        {activity.notes && (
          <div className="card">
            <h3 className="text-lg font-semibold text-text-primary mb-2">备注</h3>
            <p className="text-text-secondary">{activity.notes}</p>
          </div>
        )}

        {/* 数据来源 */}
        <div className="mt-4 text-center text-xs text-text-muted">
          <p>数据来源：Intervals.icu</p>
        </div>
      </div>
    </div>
  )
}

export default ActivityDetail
