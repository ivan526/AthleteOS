import { useEffect, useState } from 'react'
import { ArrowLeft, MessageSquareText } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { getFeedbackHistory, type FeedbackHistoryItem } from '../lib/api'

const feedbackLabels: Record<string, string> = {
  too_tired: '太累了',
  not_enough_time: '时间不足',
  pain_or_discomfort: '疼痛或不适',
  change_sport: '更换运动',
  skip_today: '今天休息',
  completed_as_planned: '按计划完成',
  completed_modified: '调整后完成',
  completed_more: '完成更多',
  completed_less: '完成较少',
  illness: '身体不适',
  travel: '出行',
  stress_high: '压力较高',
  other: '其他反馈',
}

const FeedbackHistory = () => {
  const [items, setItems] = useState<FeedbackHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFeedbackHistory(100)
      .then(setItems)
      .catch((err) => setError(err.message || '加载反馈记录失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="p-4">
        <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary mb-6">
          <ArrowLeft size={20} />
          <span>返回今日训练</span>
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">反馈记录</h1>
          <p className="text-text-secondary">查看训练调整、完成情况和主观状态记录</p>
        </div>

        {loading && <p className="text-text-secondary">加载中...</p>}
        {error && <p className="text-status-danger">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="card text-center py-10">
            <MessageSquareText size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">还没有反馈记录</p>
          </div>
        )}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-text-primary">
                    {feedbackLabels[item.feedback_type] ?? item.feedback_type}
                  </p>
                  <p className="text-sm text-text-secondary">{item.date} · {item.recommendation.title}</p>
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {item.subjective_fatigue != null && <span className="tag">疲劳 {item.subjective_fatigue}/10</span>}
                {item.available_time_minutes != null && <span className="tag">可用 {item.available_time_minutes} 分钟</span>}
                {item.pain && <span className="tag">疼痛反馈</span>}
                {item.preferred_sport && <span className="tag">{item.preferred_sport}</span>}
                <span className="tag">TSS {item.recommendation.expected_tss}</span>
              </div>
              {(item.note || item.pain_area) && (
                <p className="text-sm text-text-secondary mt-3">{item.note || item.pain_area}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default FeedbackHistory
