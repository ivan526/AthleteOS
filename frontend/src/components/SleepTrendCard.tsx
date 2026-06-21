import { HeartPulse, Moon } from 'lucide-react'
import type { WellnessHistoryItem } from '../lib/api'

interface SleepTrendCardProps {
  items: WellnessHistoryItem[]
}

const dayLabel = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' })
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

export default function SleepTrendCard({ items }: SleepTrendCardProps) {
  const preferredByDate = new Map<string, WellnessHistoryItem>()
  for (const item of items) {
    const existing = preferredByDate.get(item.date)
    const hasSleep = item.sleep_hours != null || item.sleep_score != null
    const existingHasSleep =
      existing?.sleep_hours != null || existing?.sleep_score != null
    if (
      !existing ||
      (!existingHasSleep && hasSleep) ||
      (hasSleep &&
        existingHasSleep &&
        item.source.includes('garmin') &&
        !existing.source.includes('garmin'))
    ) {
      preferredByDate.set(item.date, item)
    }
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const key = dateKey(date)
    return { key, date, item: preferredByDate.get(key) }
  })
  const available = days.map((day) => day.item).filter(Boolean) as WellnessHistoryItem[]
  const latest = [...available].reverse()[0]
  const latestHrv = items.find((item) => item.hrv_ms != null)
  const sleepHours = available
    .map((item) => item.sleep_hours)
    .filter((value): value is number => value != null)
  const averageHours = sleepHours.length
    ? sleepHours.reduce((sum, value) => sum + value, 0) / sleepHours.length
    : null

  return (
    <section className="card mb-4" aria-labelledby="sleep-trend-title">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 id="sleep-trend-title" className="font-semibold text-text-primary flex items-center gap-2">
            <Moon size={19} className="text-primary" />
            睡眠恢复
          </h2>
          <p className="text-sm text-text-secondary mt-1">最近 7 天的睡眠时长与恢复评分</p>
        </div>
        {latest && (
          <div className="text-right">
            <p className="text-xl font-bold text-text-primary">
              {latest.sleep_score != null ? Math.round(latest.sleep_score) : '--'}
            </p>
            <p className="text-xs text-text-secondary">最新评分</p>
          </div>
        )}
      </div>

      {available.length === 0 ? (
        <div className="rounded-lg bg-background-weak px-4 py-5 text-sm text-text-secondary">
          暂无近 7 天睡眠记录，完成 Garmin 或 Intervals.icu 同步后会显示趋势。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 h-32 items-end" aria-label="最近七天睡眠趋势">
            {days.map(({ key, date, item }) => {
              const height = item?.sleep_hours != null
                ? Math.max(12, Math.min(100, (item.sleep_hours / 10) * 100))
                : item?.sleep_score != null
                  ? Math.max(12, item.sleep_score)
                  : 6
              return (
                <div key={key} className="h-full flex flex-col justify-end items-center gap-1.5">
                  <span className="text-[11px] text-text-secondary">
                    {item?.sleep_hours != null ? `${item.sleep_hours.toFixed(1)}h` : ''}
                  </span>
                  <div className="h-20 w-full flex items-end justify-center">
                    <div
                      className={`w-full max-w-8 rounded-t-md ${
                        item ? 'bg-primary/70' : 'bg-border/60'
                      }`}
                      style={{ height: `${height}%` }}
                      title={item
                        ? `${key}：${item.sleep_hours?.toFixed(1) ?? '--'} 小时，评分 ${item.sleep_score ?? '--'}`
                        : `${key}：无数据`}
                    />
                  </div>
                  <span className="text-[11px] text-text-secondary">{dayLabel.format(date)}</span>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg bg-background-weak px-3 py-3">
              <p className="text-xs text-text-secondary">7 天平均睡眠</p>
              <p className="mt-1 font-semibold text-text-primary">
                {averageHours != null ? `${averageHours.toFixed(1)} 小时` : '暂无时长'}
              </p>
            </div>
            <div className="rounded-lg bg-background-weak px-3 py-3">
              <p className="text-xs text-text-secondary flex items-center gap-1">
                <HeartPulse size={13} />
                最新 HRV
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {latestHrv?.hrv_ms != null ? `${Math.round(latestHrv.hrv_ms)} ms` : '暂无数据'}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
