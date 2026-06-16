import { useState } from 'react'
import { ChevronLeft, ChevronRight, Trophy, AlertTriangle, TrendingUp } from 'lucide-react'
import Layout from '../components/Layout'

// 生成多周模拟数据
const generateMockWeeklyData = (weekOffset: number) => {
  const baseDate = new Date()
  // 计算周一的日期
  const currentDay = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - currentDay + 1 - (weekOffset * 7))

  const weekStart = new Date(monday)
  const weekEnd = new Date(monday)
  weekEnd.setDate(monday.getDate() + 6)

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const formatDisplayDate = (date: Date) => {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // 基础TSS值，每周有变化
  void (400 + weekOffset * 30 + Math.floor(Math.random() * 50))
  const adherence = 0.7 + Math.random() * 0.3
  const loadChange = (Math.random() - 0.5) * 0.2 // -10% ~ +10%

  // 生成每日数据
  const dailyStats = []
  const workoutTypes = ['easy_run', 'tempo_run', 'interval_run', 'long_easy_run', 'strength', 'recovery']

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + i)

    // 20%概率休息
    if (Math.random() > 0.8) {
      dailyStats.push({
        date: formatDisplayDate(dayDate),
        tss: 0,
        type: 'rest'
      })
    } else {
      const type = workoutTypes[Math.floor(Math.random() * workoutTypes.length)]
      let tss: number

      if (type.includes('easy')) tss = 20 + Math.floor(Math.random() * 30)
      else if (type.includes('tempo')) tss = 50 + Math.floor(Math.random() * 30)
      else if (type.includes('interval')) tss = 70 + Math.floor(Math.random() * 30)
      else if (type.includes('long')) tss = 80 + Math.floor(Math.random() * 40)
      else if (type.includes('strength')) tss = 30 + Math.floor(Math.random() * 20)
      else tss = 10 + Math.floor(Math.random() * 20)

      dailyStats.push({
        date: formatDisplayDate(dayDate),
        tss,
        type
      })
    }
  }

  const weeklyTss = dailyStats.reduce((sum, day) => sum + day.tss, 0)

  // 随机生成风险等级
  const riskLevels: Array<'low' | 'moderate' | 'elevated' | 'high_caution'> = ['low', 'moderate', 'elevated', 'high_caution']
  const trainingRiskLevel = riskLevels[Math.floor(Math.random() * 2)] // 大部分低或中等风险

  return {
    weekStart: formatDate(weekStart),
    weekEnd: formatDate(weekEnd),
    summary: loadChange > 0.05
      ? '本周训练负荷有所上升，整体完成情况良好。'
      : loadChange < -0.05
        ? '本周训练负荷有所下降，以恢复调整为主。'
        : '本周训练负荷稳定，完成情况良好。',
    adherence,
    weeklyTss,
    loadChangeVsLastWeek: loadChange,
    trainingRiskLevel,
    highlights: [
      `完成 ${Math.round(adherence * 7)} 次训练，完成率 ${Math.round(adherence * 100)}%`,
      `周负荷 ${loadChange > 0 ? '增长' : '下降'} ${Math.abs(Math.round(loadChange * 100))}%，${Math.abs(loadChange) < 0.1 ? '处于合理范围' : loadChange > 0 ? '增长偏快，注意恢复' : '下降明显，适合调整'}`,
      '训练节奏控制良好',
    ],
    warnings: loadChange > 0.08
      ? [
        '周负荷增长较快，注意充分恢复',
        '建议下周适当控制高强度训练次数',
      ]
      : loadChange < -0.08
        ? [
          '本周训练量较低，下周可以适当增加负荷',
          '保持规律的训练节奏更有利于进步',
        ]
        : [
          '训练结构合理，继续保持',
          '保证充足睡眠和营养补充',
        ],
    nextWeekRecommendation: loadChange > 0.08
      ? '下周建议适当降低训练负荷，增加恢复性训练，避免过度训练。'
      : loadChange < -0.08
        ? '下周可以适当增加训练负荷，逐步提升训练强度，保持训练连续性。'
        : '下周可以维持当前训练节奏，适当增加训练多样性，提升训练效果。',
    dailyStats,
  }
}

const WeeklyReview = () => {
  const [weekOffset, setWeekOffset] = useState(0)
  const [currentWeek, setCurrentWeek] = useState(generateMockWeeklyData(0))

  const changeWeek = (delta: number) => {
    const newOffset = weekOffset + delta
    setWeekOffset(newOffset)
    setCurrentWeek(generateMockWeeklyData(newOffset))
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-status-success bg-green-50'
      case 'moderate':
        return 'text-status-warning bg-orange-50'
      case 'elevated':
      case 'high_caution':
        return 'text-status-danger bg-red-50'
      default:
        return 'text-text-secondary bg-gray-50'
    }
  }

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'low':
        return '训练风险较低'
      case 'moderate':
        return '训练风险中等'
      case 'elevated':
        return '训练风险偏高'
      case 'high_caution':
        return '训练风险较高'
      default:
        return '训练风险未知'
    }
  }

  const getWorkoutTypeColor = (type: string) => {
    if (type.includes('easy') || type.includes('recovery')) return 'bg-status-success/20 text-status-success'
    if (type.includes('tempo') || type.includes('steady')) return 'bg-status-warning/20 text-status-warning'
    if (type.includes('interval') || type.includes('threshold')) return 'bg-status-danger/20 text-status-danger'
    if (type.includes('long')) return 'bg-primary/20 text-primary'
    return 'bg-gray-100 text-text-secondary'
  }

  const maxTss = Math.max(...currentWeek.dailyStats.map(d => d.tss), 100)

  return (
    <Layout>
      <div className="p-4">
        {/* 页面头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-text-primary">每周复盘</h1>
            <div className="flex items-center gap-2">
              <button
                className="p-2 hover:bg-background-weak rounded-lg transition-colors"
                onClick={() => changeWeek(1)}
              >
                <ChevronLeft size={20} className="text-text-secondary" />
              </button>
              <button
                className="p-2 hover:bg-background-weak rounded-lg transition-colors"
                onClick={() => changeWeek(-1)}
                disabled={weekOffset === 0}
              >
                <ChevronRight size={20} className={`${weekOffset === 0 ? 'text-text-secondary/30' : 'text-text-secondary'}`} />
              </button>
            </div>
          </div>
          <p className="text-text-secondary">
            {currentWeek.weekStart} ~ {currentWeek.weekEnd}
          </p>
        </div>

        {/* 周总结卡片 */}
        <div className="card mb-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-1">周总结</h3>
            <p className="text-text-secondary">{currentWeek.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">完成率</p>
              <p className="text-2xl font-bold text-text-primary">
                {Math.round(currentWeek.adherence * 100)}%
              </p>
              <p className="text-xs text-text-secondary">
                {currentWeek.dailyStats.filter(d => d.tss > 0).length}/7 次训练
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">周训练负荷</p>
              <p className="text-2xl font-bold text-text-primary">{currentWeek.weeklyTss}</p>
              <p className="text-xs text-status-success">
                {currentWeek.loadChangeVsLastWeek > 0 ? '+' : ''}
                {Math.round(currentWeek.loadChangeVsLastWeek * 100)}% 较上周
              </p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">恢复趋势</p>
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp size={18} className="text-status-success" />
                <span className="text-2xl font-bold text-text-primary">稳定</span>
              </div>
            </div>
            <div className="p-3 bg-background-weak rounded-lg text-center">
              <p className="text-xs text-text-secondary mb-1">训练风险</p>
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-1 ${getRiskColor(currentWeek.trainingRiskLevel)}`}>
                {getRiskLabel(currentWeek.trainingRiskLevel)}
              </div>
            </div>
          </div>

          {/* 每日TSS柱状图 */}
          <div className="p-3 bg-background-weak rounded-lg mb-4">
            <p className="text-sm font-medium text-text-primary mb-3">每日训练负荷</p>
            <div className="flex items-end justify-between h-32 gap-1">
              {currentWeek.dailyStats.map((day, index) => (
                <div key={index} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-md ${getWorkoutTypeColor(day.type)}`}
                      style={{ height: `${(day.tss / maxTss) * 100}%`, minHeight: '4px' }}
                    ></div>
                    {day.tss > 0 && (
                      <span className="text-xs font-medium text-text-primary">{day.tss}</span>
                    )}
                  </div>
                  <span className="text-xs text-text-secondary mt-1">
                    {day.date.split('月')[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 亮点卡片 */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={20} className="text-status-warning" />
            <h3 className="text-lg font-semibold text-text-primary">本周亮点</h3>
          </div>
          <ul className="space-y-2">
            {currentWeek.highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-status-warning mt-1">•</span>
                <span className="text-text-secondary">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 需要注意卡片 */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-status-danger" />
            <h3 className="text-lg font-semibold text-text-primary">需要注意</h3>
          </div>
          <ul className="space-y-2">
            {currentWeek.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-status-danger mt-1">•</span>
                <span className="text-text-secondary">{warning}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 下周建议 */}
        <div className="card mb-20">
          <h3 className="text-lg font-semibold text-text-primary mb-3">下周建议</h3>
          <p className="text-text-secondary leading-relaxed">
            {currentWeek.nextWeekRecommendation}
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default WeeklyReview
