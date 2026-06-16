import { useState } from 'react'
import { Edit, Flag, Calendar, Clock, TrendingUp, Info, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

const mockGoalData = {
  primaryGoal: '半马 1:40',
  goalDate: '2026-11-15',
  goalTime: 6000, // 1小时40分钟 = 6000秒
  primarySport: '跑步',
  weeklyAvailableDays: 5,
  preferredSports: ['跑步', '骑行'],
  goalProbability: 0.71,
  dataLevel: 'B',
}

const Goals = () => {
  const [goal] = useState(mockGoalData)

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

  const daysRemaining = () => {
    const goalDate = new Date(goal.goalDate)
    const today = new Date()
    const diffTime = goalDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 3600 * 24))
  }

  return (
    <Layout>
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-text-primary">目标</h1>
            <Link
              to="/settings/goals"
              className="p-2 hover:bg-background-weak rounded-lg transition-colors"
            >
              <Edit size={20} className="text-primary" />
            </Link>
          </div>
          <p className="text-text-secondary">设置你的运动目标，获得更精准的训练建议</p>
        </div>

        {/* 当前目标卡片 */}
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Flag size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">当前目标</h3>
          </div>

          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-text-primary mb-1">{goal.primaryGoal}</div>
            <div className="flex items-center justify-center gap-2 text-text-secondary">
              <Calendar size={16} />
              <span>目标日期：{goal.goalDate}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-text-secondary mt-1">
              <Clock size={16} />
              <span>目标时间：{formatTime(goal.goalTime)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">剩余天数</p>
              <p className="text-2xl font-bold text-text-primary">{daysRemaining()}</p>
              <p className="text-xs text-text-secondary">天</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">目标达成率</p>
              <p className={`text-2xl font-bold ${getProbabilityColor(goal.goalProbability)}`}>
                {Math.round(goal.goalProbability * 100)}%
              </p>
              <p className="text-xs text-text-secondary">{getProbabilityText(goal.goalProbability)}</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">首选运动</p>
              <p className="text-2xl font-bold text-text-primary">
                {goal.primarySport === 'running' ? '跑步' : goal.primarySport}
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">每周可训练</p>
              <p className="text-2xl font-bold text-text-primary">{goal.weeklyAvailableDays}</p>
              <p className="text-xs text-text-secondary">天</p>
            </div>
          </div>

          {goal.dataLevel === 'D' || goal.dataLevel === 'C' ? (
            <div className="p-3 bg-background-weak rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-status-info mt-1 flex-shrink-0" />
                <p className="text-sm text-text-secondary">
                  当前历史训练数据较少，目标达成率仅供参考。随着训练数据的积累，系统的预测会越来越准确。
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-background-weak rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-primary" />
                <span className="text-sm font-medium text-text-primary">当前进度</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '65%' }}></div>
              </div>
              <p className="text-xs text-text-secondary text-right">已完成 65%</p>
            </div>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="card mb-4">
          <Link
            to="/settings/goals"
            className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Flag size={20} className="text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-text-primary">修改目标设置</h3>
                <p className="text-sm text-text-secondary">调整目标赛事、时间、当前水平等信息</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>
        </div>

        {/* 目标说明 */}
        <div className="card mb-20">
          <h3 className="text-lg font-semibold text-text-primary mb-3">目标说明</h3>
          <div className="space-y-3 text-text-secondary">
            <p>
              • 系统会根据你的目标自动调整训练计划的强度和安排，帮助你科学达成目标。
            </p>
            <p>• 目标达成率会随着你的训练表现动态更新。</p>
            <p>• 当前系统会基于你的目标提供更有针对性的训练建议。</p>
            <p>• 后续版本会支持多目标管理、详细进度跟踪和阶段规划功能。</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Goals
