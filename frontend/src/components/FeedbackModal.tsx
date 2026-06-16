import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import { submitFeedback, type FeedbackRequest } from '../lib/api'

// 扩展FeedbackRequest添加pain_area字段
interface FeedbackRequestWithPain extends FeedbackRequest {
  pain_area?: string
}

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  recommendationId: string
  feedbackType: string
  onSuccess?: (result: any) => void
}

const FeedbackModal = ({ isOpen, onClose, recommendationId, feedbackType, onSuccess }: FeedbackModalProps) => {
  const [formData, setFormData] = useState<Partial<FeedbackRequestWithPain>>({
    recommendation_id: recommendationId,
    feedback_type: feedbackType as any,
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const getFeedbackTitle = (type: string) => {
    const titles: Record<string, string> = {
      too_tired: '今天感觉很累？',
      not_enough_time: '只有30分钟训练时间？',
      pain_or_discomfort: '身体有疼痛或不适？',
      change_sport: '更换运动类型',
      skip_today: '今天要休息吗？',
      prefer_easy: '想要轻松一点的训练？',
    }
    return titles[type] || '反馈'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      // 移除pain_area字段，因为API不接收
      const { pain_area, ...submitData } = formData
      const response = await submitFeedback(submitData as FeedbackRequest)
      setResult(response)
      if (onSuccess) {
        onSuccess(response)
      }
    } catch (err: any) {
      console.error('提交反馈失败', err)
      alert(`提交失败：${err.message || '请稍后重试'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const renderFormFields = () => {
    switch (feedbackType) {
      case 'too_tired':
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">
              告诉我们你的疲劳程度，系统将为你调整训练计划。
            </p>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">疲劳程度</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 3, label: '轻微疲劳', desc: '还可以继续' },
                  { value: 6, label: '比较疲劳', desc: '想降低强度' },
                  { value: 9, label: '非常疲劳', desc: '想休息' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                      formData.subjective_fatigue === option.value
                        ? 'border-primary bg-background-weak'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="subjective_fatigue"
                      value={option.value}
                      checked={formData.subjective_fatigue === option.value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subjective_fatigue: parseInt(e.target.value),
                        })
                      }
                      className="sr-only"
                    />
                    <div className="font-medium text-text-primary mb-1">{option.label}</div>
                    <div className="text-xs text-text-secondary">{option.desc}</div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 'not_enough_time':
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">调整训练时间，系统将为你生成合适的短时间训练。</p>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">可用时间（分钟）</label>
              <input
                type="number"
                min="10"
                max="120"
                value={formData.available_time_minutes || 30}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    available_time_minutes: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
        )

      case 'pain_or_discomfort':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-status-danger mt-0.5 flex-shrink-0" />
                <p className="text-sm text-status-danger">
                  如有持续疼痛或不适，请立即停止训练并咨询专业医生。系统将自动为你调整为恢复性训练。
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">疼痛部位（可选）</label>
              <input
                type="text"
                placeholder="例如：左膝盖、小腿等"
                value={formData.pain_area || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pain: true,
                    pain_area: e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div className="p-3 bg-background-weak rounded-xl">
              <p className="text-sm text-text-secondary">
                系统将自动把今日训练调整为恢复性训练，避免加重疼痛。
              </p>
            </div>
          </div>
        )

      case 'change_sport':
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">选择你想要更换的运动类型。</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'running', label: '跑步', emoji: '🏃' },
                { value: 'cycling', label: '骑行', emoji: '🚴' },
                { value: 'swimming', label: '游泳', emoji: '🏊' },
                { value: 'strength', label: '力量训练', emoji: '💪' },
              ].map((sport) => (
                <label
                  key={sport.value}
                  className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                    formData.preferred_sport === sport.value
                      ? 'border-primary bg-background-weak'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="preferred_sport"
                    value={sport.value}
                    checked={formData.preferred_sport === sport.value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferred_sport: e.target.value,
                      })
                    }
                    className="sr-only"
                  />
                  <div className="text-2xl mb-1">{sport.emoji}</div>
                  <div className="font-medium text-text-primary">{sport.label}</div>
                </label>
              ))}
            </div>
          </div>
        )

      case 'skip_today':
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">
              确定今天要休息吗？系统会记录你的休息情况，调整后续训练计划。
            </p>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">备注（可选）</label>
              <textarea
                placeholder="例如：身体不适、工作太忙等"
                value={formData.note || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    note: e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all min-h-[80px]"
              />
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">确认提交此反馈吗？</p>
          </div>
        )
    }
  }

  if (result) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="调整完成">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-status-success" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">调整成功</h3>
          <p className="text-text-secondary mb-6">{result.reason}</p>
          {result.new_recommendation && (
            <div className="card mb-4 text-left">
              <div className="text-center mb-2">
                <div className="text-lg font-semibold text-text-primary">
                  {result.new_recommendation.title}
                </div>
                <div className="flex justify-center gap-2 mt-1">
                  <span className="tag">{result.new_recommendation.duration_minutes} 分钟</span>
                  <span className="tag">TSS {result.new_recommendation.expected_tss}</span>
                  <span className="tag">
                    {result.new_recommendation.intensity === 'moderate'
                      ? '中等强度'
                      : result.new_recommendation.intensity === 'high'
                      ? '高强度'
                      : '低强度'}
                  </span>
                </div>
              </div>
            </div>
          )}
          <button onClick={onClose} className="btn-primary w-full">
            确定
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getFeedbackTitle(feedbackType)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {renderFormFields()}

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={submitting}
          >
            取消
          </button>
          <button type="submit" className="flex-1 btn-primary" disabled={submitting}>
            {submitting ? '提交中...' : '确认调整'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default FeedbackModal
