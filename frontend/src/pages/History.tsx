import { useState, useEffect } from 'react'
import { Calendar, ChevronRight, TrendingUp, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

// 模拟历史活动数据
const mockActivities = [
  {
    id: '1',
    date: '2026-06-14',
    type: '跑步',
    name: '节奏跑',
    duration: '50 分钟',
    distance: '10.2 公里',
    tss: 65,
    intensity: '中等强度',
  },
  {
    id: '2',
    date: '2026-06-13',
    type: '跑步',
    name: '轻松跑',
    duration: '35 分钟',
    distance: '6.8 公里',
    tss: 32,
    intensity: '低强度',
  },
  {
    id: '3',
    date: '2026-06-12',
    type: '力量训练',
    name: '核心训练',
    duration: '45 分钟',
    distance: '-',
    tss: 40,
    intensity: '中等强度',
  },
  {
    id: '4',
    date: '2026-06-11',
    type: '跑步',
    name: '间歇跑',
    duration: '65 分钟',
    distance: '12.5 公里',
    tss: 82,
    intensity: '高强度',
  },
  {
    id: '5',
    date: '2026-06-10',
    type: '跑步',
    name: '轻松跑',
    duration: '30 分钟',
    distance: '5.5 公里',
    tss: 28,
    intensity: '低强度',
  },
  {
    id: '6',
    date: '2026-06-09',
    type: '休息',
    name: '休息日',
    duration: '-',
    distance: '-',
    tss: 0,
    intensity: '-',
  },
  {
    id: '7',
    date: '2026-06-08',
    type: '跑步',
    name: '长距离慢跑',
    duration: '90 分钟',
    distance: '18.3 公里',
    tss: 95,
    intensity: '中等强度',
  },
  {
    id: '8',
    date: '2026-06-07',
    type: '骑行',
    name: '户外骑行',
    duration: '80 分钟',
    distance: '28.5 公里',
    tss: 72,
    intensity: '中等强度',
  },
  {
    id: '9',
    date: '2026-06-06',
    type: '跑步',
    name: '轻松跑',
    duration: '40 分钟',
    distance: '7.2 公里',
    tss: 38,
    intensity: '低强度',
  },
  {
    id: '10',
    date: '2026-06-05',
    type: '跑步',
    name: '阈值跑',
    duration: '55 分钟',
    distance: '11.5 公里',
    tss: 78,
    intensity: '高强度',
  },
  {
    id: '11',
    date: '2026-06-04',
    type: '休息',
    name: '休息日',
    duration: '-',
    distance: '-',
    tss: 0,
    intensity: '-',
  },
  {
    id: '12',
    date: '2026-06-03',
    type: '跑步',
    name: '长距离慢跑',
    duration: '100 分钟',
    distance: '20.5 公里',
    tss: 105,
    intensity: '中等强度',
  },
]

// 生成日历数据
const generateCalendarData = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekDay = firstDay.getDay() // 0 = 周日, 1 = 周一...

  const days = []

  // 添加上个月的填充天数
  for (let i = 0; i < startWeekDay; i++) {
    days.push({ date: null, type: 'empty' })
  }

  // 添加当月天数
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const activity = mockActivities.find(a => a.date === dateStr)

    let type = 'rest'
    let intensity = 'low'

    if (activity) {
      if (activity.type === '休息') {
        type = 'rest'
      } else if (activity.intensity === '低强度') {
        type = 'easy'
        intensity = 'low'
      } else if (activity.intensity === '中等强度') {
        type = 'moderate'
        intensity = 'medium'
      } else if (activity.intensity === '高强度') {
        type = 'hard'
        intensity = 'high'
      }
    }

    days.push({
      date: i,
      fullDate: dateStr,
      activity,
      type,
      intensity,
    })
  }

  return days
}

// 周统计数据
const weeklyStats = [
  { week: '第24周', tss: 430, change: '+6%' },
  { week: '第23周', tss: 406, change: '+3%' },
  { week: '第22周', tss: 394, change: '-2%' },
  { week: '第21周', tss: 402, change: '+8%' },
]

const History = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week')
  const [activities] = useState(mockActivities)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarData, setCalendarData] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    setCalendarData(generateCalendarData(year, month))
  }, [currentMonth])

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case '跑步':
        return '🏃'
      case '骑行':
        return '🚴'
      case '游泳':
        return '🏊'
      case '力量训练':
        return '💪'
      default:
        return '📅'
    }
  }

  return (
    <Layout>
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">历史</h1>
          <p className="text-text-secondary">查看你的训练记录和负荷趋势</p>
        </div>

        {/* 周/月切换 */}
        <div className="flex bg-white rounded-xl p-1 mb-6 border border-border/60">
          <button
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              selectedPeriod === 'week'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setSelectedPeriod('week')}
          >
            周视图
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              selectedPeriod === 'month'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setSelectedPeriod('month')}
          >
            月视图
          </button>
        </div>

        {/* 月视图 */}
        {selectedPeriod === 'month' && (
          <>
            {/* 月份选择器 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-background-weak rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-text-primary" />
              </button>
              <h3 className="text-lg font-semibold text-text-primary">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-background-weak rounded-lg transition-colors"
              >
                <ChevronRightIcon size={20} className="text-text-primary" />
              </button>
            </div>

            {/* 日历表头 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-text-secondary py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* 日历网格 */}
            <div className="grid grid-cols-7 gap-1 mb-6">
              {calendarData.map((day, index) => {
                if (day.date === null) {
                  return <div key={`empty-${index}`} className="aspect-square"></div>
                }

                const getDayColor = () => {
                  if (day.type === 'rest' && !day.activity) return 'bg-gray-50'
                  if (day.type === 'empty') return ''
                  if (day.intensity === 'low') return 'bg-green-100'
                  if (day.intensity === 'medium') return 'bg-yellow-100'
                  if (day.intensity === 'high') return 'bg-red-100'
                  return 'bg-gray-100'
                }

                return (
                  <div
                    key={`day-${index}`}
                    className={`aspect-square rounded-lg p-1 ${getDayColor()} ${
                      day.activity ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''
                    }`}
                    onClick={() => day.activity && navigate(`/activity/${day.activity.id}`)}
                  >
                    <div className="text-xs font-medium text-text-primary mb-1">
                      {day.date}
                    </div>
                    {day.activity && (
                      <div className="text-[10px] text-text-secondary truncate">
                        {day.activity.type === '跑步' ? '🏃' :
                         day.activity.type === '骑行' ? '🚴' :
                         day.activity.type === '游泳' ? '🏊' :
                         day.activity.type === '力量训练' ? '💪' : ''}
                        {day.activity.tss > 0 && (
                          <span className="ml-0.5">{day.activity.tss}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 图例 */}
            <div className="card mb-4">
              <h4 className="text-sm font-medium text-text-primary mb-3">图例</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100"></div>
                  <span className="text-xs text-text-secondary">低强度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-100"></div>
                  <span className="text-xs text-text-secondary">中等强度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100"></div>
                  <span className="text-xs text-text-secondary">高强度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100"></div>
                  <span className="text-xs text-text-secondary">休息</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 本周统计卡片 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">本周统计</h3>
            <span className="text-sm text-text-secondary">6月8日 - 6月14日</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">总 TSS</p>
              <p className="text-2xl font-bold text-text-primary">430</p>
              <p className="text-xs text-status-success">较上周 +6%</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">训练次数</p>
              <p className="text-2xl font-bold text-text-primary">5/6</p>
              <p className="text-xs text-text-secondary">完成率 83%</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">平均强度</p>
              <p className="text-2xl font-bold text-text-primary">中等</p>
              <p className="text-xs text-text-secondary">趋势稳定</p>
            </div>
            <div className="p-3 bg-background-weak rounded-lg">
              <p className="text-xs text-text-secondary mb-1">训练风险</p>
              <p className="text-2xl font-bold text-status-warning">略有上升</p>
              <p className="text-xs text-text-secondary">建议控制强度</p>
            </div>
          </div>

          {/* 周趋势 */}
          <div className="p-3 bg-background-weak rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-sm font-medium text-text-primary">近4周TSS趋势</span>
            </div>
            <div className="space-y-2">
              {weeklyStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">{stat.week}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(stat.tss / 500) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-text-primary w-10 text-right">
                      {stat.tss}
                    </span>
                    <span
                      className={`text-xs ${
                        stat.change.startsWith('+') ? 'text-status-success' : 'text-text-secondary'
                      }`}
                    >
                      {stat.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 周视图活动列表 */}
        {selectedPeriod === 'week' && (
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-3">训练记录</h3>
            <div className="space-y-3 mb-20">
              {activities.slice(0, 7).map((activity) => (
                <Link
                  key={activity.id}
                  to={activity.type !== '休息' ? `/activity/${activity.id}` : '#'}
                  className={`block card p-4 ${activity.type === '休息' ? 'cursor-default' : 'hover:border-primary/50 transition-colors'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-1">{getActivityIcon(activity.type)}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-text-primary">{activity.name}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getIntensityColor(
                              activity.intensity
                            )}`}
                          >
                            {activity.intensity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                          <Calendar size={14} />
                          <span>{activity.date}</span>
                          <span>•</span>
                          <span>{activity.duration}</span>
                          {activity.distance !== '-' && (
                            <>
                              <span>•</span>
                              <span>{activity.distance}</span>
                            </>
                          )}
                        </div>
                        {activity.tss > 0 && (
                          <div className="text-sm text-primary">TSS {activity.tss}</div>
                        )}
                      </div>
                    </div>
                    {activity.type !== '休息' && (
                      <ChevronRight size={20} className="text-text-secondary mt-2" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default History
