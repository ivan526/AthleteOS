import { useState, useEffect } from 'react'
import { Edit, Flag, Calendar, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

// 目标数据接口
interface GoalData {
  primaryGoal: string
  goalDate: string
  goalTime: number
  primarySport: string
  weeklyAvailableDays: number
  preferredSports: string[]
  goalProbability: number
  dataLevel: string
}

const Goals = () => {
  const [goal] = useState<GoalData | null>(null)
  const [loading, setLoading] = useState(true)

  // TODO: 替换为真实API调用
  useEffect(() => {
    // 暂时显示提示，目标功能需要在设置中配置
    setLoading(false)
    // 实际使用时从API获取数据
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  const getProbabilityText = (probability: number) => {
    if (probability >= 0.8) return '可能性很高'
    if (probability >= 0.6) return '可能性较高'
    if (probability >= 0.4) return '可能性中等'
    return '可能性较低'
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.8) return 'text-status-success'
    if (probability >= 0.6) return 'text-status-warning'
    return 'text-text-secondary'
  }

  const daysRemaining = (goalDate: string) => {
    const date = new Date(goalDate)
    const today = new Date()
    const diffTime = date.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 3600 * 24))
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-text-primary">我的目标</h1>
              <Link to="/settings/goals" className="flex items-center gap-1 text-primary text-sm">
                <Edit size={16} />
                编辑
              </Link>
            </div>
            <p className="text-text-secondary">查看目标进度和达成概率</p>
          </div>
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-text-secondary">加载中...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!goal) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-text-primary">我的目标</h1>
              <Link to="/settings/goals" className="flex items-center gap-1 text-primary text-sm">
                <Edit size={16} />
                设置
              </Link>
            </div>
            <p className="text-text-secondary">查看目标进度和达成概率</p>
          </div>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-background-weak flex items-center justify-center">
              <Flag size={40} className="text-text-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">还没有设置训练目标</h3>
              <p className="text-text-secondary mb-4 max-w-xs mx-auto">
                设置你的训练目标，系统将为你定制个性化训练计划，提升训练效率。
              </p>
              <Link to="/settings/goals" className="btn-primary inline-flex">
                去设置目标
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-text-primary">我的目标</h1>
            <Link to="/settings/goals" className="flex items-center gap-1 text-primary text-sm">
              <Edit size={16} />
              编辑
            </Link>
          </div>
          <p className="text-text-secondary">查看目标进度和达成概率</p>
        </div>

        {/* 目标卡片 */}
        <div className="card mb-6 text-center">
          <div className="text-4xl mb-2">🏃</div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">{goal.primaryGoal}</h2>
          <p className="text-text-secondary mb-4">
            <Calendar size={14} className="inline mr-1" />
            {goal.goalDate} · 剩余 {daysRemaining(goal.goalDate)} 天
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">目标时间</p>
              <p className="text-xl font-bold text-text-primary">{formatTime(goal.goalTime)}</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">达成概率</p>
              <p className={`text-xl font-bold ${getProbabilityColor(goal.goalProbability)}`}>
                {Math.round(goal.goalProbability * 100)}%
              </p>
              <p className="text-xs text-text-secondary">{getProbabilityText(goal.goalProbability)}</p>
            </div>
          </div>
        </div>

        {/* 目标分析 */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-3">目标分析</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">主项运动</span>
              <span className="font-medium text-text-primary">{goal.primarySport}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">每周可训练天数</span>
              <span className="font-medium text-text-primary">{goal.weeklyAvailableDays} 天</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">偏好运动类型</span>
              <span className="font-medium text-text-primary">{goal.preferredSports.join('、')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">数据质量等级</span>
              <span className="font-medium text-text-primary">Level {goal.dataLevel}</span>
            </div>
          </div>
        </div>

        {/* 训练建议 */}
        <div className="card bg-background-weak border-primary/20">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-text-primary mb-1">训练建议</h4>
              <p className="text-sm text-text-secondary">
                以你当前的训练水平，每周保持5次训练，控制周负荷增长不超过10%，预计可以在目标时间前达到半马140的能力。训练过程中注意充分恢复，避免受伤。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Goals
