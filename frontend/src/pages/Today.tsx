import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Info, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import FeedbackModal from '../components/FeedbackModal'
import { getTodayData, submitFeedback, type TodayResponse } from '../lib/api'

const Today = () => {
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false)
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdjusted, setShowAdjusted] = useState(false)
  const [adjustedMessage, setAdjustedMessage] = useState('')
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean
    type: string
  }>({ isOpen: false, type: '' })

  // 获取今日数据
  useEffect(() => {
    fetchTodayData()
  }, [])

  const fetchTodayData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTodayData()
      setData(result)
      setShowAdjusted(false)
    } catch (err: any) {
      setError(err.message || '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理用户反馈
  const handleFeedback = (option: string) => {
    if (!data) return

    // 简单映射反馈类型
    const feedbackTypeMap: Record<string, string> = {
      '太累了': 'too_tired',
      '只有30分钟': 'not_enough_time',
      '腿部不适': 'pain_or_discomfort',
      '换成骑行': 'change_sport',
      '今天休息': 'skip_today',
      '已完成': 'completed_as_planned',
    }

    const feedbackType = feedbackTypeMap[option] || option

    // 对不需要表单的反馈类型直接提交
    const simpleFeedbackTypes = ['completed_as_planned', 'completed_modified', 'completed_more', 'completed_less', 'illness', 'travel', 'stress_high']

    if (simpleFeedbackTypes.includes(feedbackType)) {
      // 直接提交简单反馈
      const submitSimpleFeedback = async () => {
        try {
          await submitFeedback({
            recommendation_id: data.recommendation.id,
            feedback_type: feedbackType as any,
          })
          alert('反馈已提交')
        } catch (err: any) {
          alert(`提交失败: ${err.message}`)
        }
      }
      submitSimpleFeedback()
    } else {
      // 打开反馈表单弹窗
      setFeedbackModal({
        isOpen: true,
        type: feedbackType,
      })
    }
  }

  // 反馈提交成功回调
  const handleFeedbackSuccess = (result: any) => {
    setFeedbackModal({ isOpen: false, type: '' })
    if (result.adjusted) {
      setAdjustedMessage(result.reason)
      setShowAdjusted(true)
      // 重新获取数据更新页面
      setTimeout(fetchTodayData, 2000)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4 flex items-center justify-center h-[60vh]">
          <p className="text-text-secondary">加载中...</p>
        </div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="p-4 flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-text-secondary">{error || '数据加载失败'}</p>
          <button className="btn-primary" onClick={fetchTodayData}>
            重新加载
          </button>
        </div>
      </Layout>
    )
  }

  const getCapacityColor = (score: number) => {
    if (score >= 80) return 'text-status-success'
    if (score >= 60) return 'text-primary'
    if (score >= 40) return 'text-status-warning'
    return 'text-status-danger'
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

  return (
    <Layout>
      <div className="p-4">
        {/* 调整成功提示 */}
        {showAdjusted && (
          <div className="mb-4 p-4 bg-background-weak rounded-xl border border-primary/20">
            <p className="text-primary font-medium">{adjustedMessage}</p>
          </div>
        )}

        {/* 页面头部 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">今日训练</h1>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>{data.date}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-status-info">
              <Info size={14} />
              数据来源：Intervals.icu
            </span>
          </div>
        </div>

        {/* 训练能力卡片 */}
        <div className="card mb-4 text-center">
          <p className="text-lg font-medium text-text-primary mb-2">今日训练能力</p>
          <div className={`text-6xl font-bold mb-2 ${getCapacityColor(data.training_capacity.score)}`}>
            {data.training_capacity.score}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="tag">
              {data.training_capacity.status === 'Train Normally'
                ? '适合正常训练'
                : data.training_capacity.status === 'Ready To Push'
                ? '状态极佳，可以加量'
                : data.training_capacity.status === 'Reduce Intensity'
                ? '建议降低强度'
                : '需要恢复'}
            </div>
            <p className="text-sm text-text-secondary">
              较昨日 {data.training_capacity.trend_vs_yesterday} · {data.training_capacity.confidence_label}
            </p>
            <p className="text-base text-text-primary mt-2">{data.explanation.simple}</p>
          </div>
        </div>

        {/* 训练建议卡片 */}
        <div className="card mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-1">
                {data.recommendation.title}
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="tag">{data.recommendation.duration_minutes} 分钟</span>
                <span className="tag">预计负荷 TSS {data.recommendation.expected_tss}</span>
                <span className="tag">{data.recommendation.intensity === 'moderate' ? '中等强度' : data.recommendation.intensity === 'high' ? '高强度' : '低强度'}</span>
              </div>
            </div>
          </div>

          <Link
            to={`/workout/${data.recommendation.id}`}
            className="flex items-center justify-between p-3 bg-background-weak rounded-xl mb-4 text-primary font-medium hover:bg-background-weak/80 transition-colors"
          >
            <span>查看训练详情</span>
            <ChevronRight size={20} />
          </Link>

          <div className="mt-4 p-4 bg-background-weak rounded-xl">
            <h4 className="font-medium text-text-primary mb-2">训练结构：</h4>
            <ul className="space-y-2 text-text-secondary">
              {data.recommendation.structure.warmup && (
                <li>• {data.recommendation.structure.warmup}</li>
              )}
              <li>• {data.recommendation.structure.main_set}</li>
              {data.recommendation.structure.cooldown && (
                <li>• {data.recommendation.structure.cooldown}</li>
              )}
            </ul>
            <p className="mt-3 text-sm text-text-secondary">
              强度提示：呼吸有压力，但不应进入冲刺状态。
            </p>
          </div>
        </div>

        {/* 解释卡片 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">为什么这样安排？</h3>
          <ul className="space-y-2">
            {data.explanation.reasons.map((reason, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="text-text-secondary">{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 风险提示 */}
        <div className={`p-3 rounded-xl mb-4 ${getRiskColor(data.training_risk.level)}`}>
          <p className="text-sm font-medium">{data.training_risk.label}</p>
        </div>

        {/* 反馈按钮区 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-3">今天情况有变化？</h3>
          <div className="grid grid-cols-3 gap-2">
            {data.feedback_options.map((option, index) => {
              // 转换为中文标签
              const labelMap: Record<string, string> = {
                'too_tired': '太累了',
                'not_enough_time': '只有30分钟',
                'pain_or_discomfort': '腿部不适',
                'change_sport': '换成骑行',
                'skip_today': '今天休息',
                'completed_as_planned': '已完成',
              }
              const label = labelMap[option] || option
              return (
                <button
                  key={index}
                  className="btn-secondary h-auto py-3 text-sm"
                  onClick={() => handleFeedback(label)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 技术详情抽屉 */}
        <div className="card mb-20">
          <button
            className="w-full flex items-center justify-between text-text-primary font-medium"
            onClick={() => setShowTechnicalDetail(!showTechnicalDetail)}
          >
            <span>决策依据</span>
            {showTechnicalDetail ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showTechnicalDetail && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">CTL</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.form ? (data.explanation.technical.form + (data.explanation.technical.ctl || 0)).toFixed(1) : '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">ATL</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.ctl ? (data.explanation.technical.ctl - data.explanation.technical.form).toFixed(1) : '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">Form</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.form?.toFixed(1) || '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">ACWR</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.acwr?.toFixed(2) || '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">Monotony</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.monotony?.toFixed(2) || '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">睡眠评分</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.sleep_score || '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">HRV评分</p>
                  <p className="text-lg font-semibold">{data.explanation.technical.hrv_score || '-'}</p>
                </div>
                <div className="p-3 bg-background-weak rounded-lg">
                  <p className="text-xs text-text-secondary mb-1">可信度</p>
                  <p className="text-lg font-semibold">
                    {data.explanation.technical.confidence ? Math.round(data.explanation.technical.confidence * 100) + '%' : '-'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-background-weak rounded-lg">
                <p className="text-xs text-text-secondary mb-2">安全规则</p>
                {data.explanation.technical.triggered_rules && data.explanation.technical.triggered_rules.length > 0 ? (
                  <ul className="space-y-1 text-sm text-text-secondary">
                    {data.explanation.technical.triggered_rules.map((rule, index) => (
                      <li key={index}>• {rule.rule}: {rule.action}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-secondary">未触发硬性安全规则</p>
                )}
              </div>

              <Link
                to="/decision"
                className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg text-primary font-medium hover:bg-primary/20 transition-colors"
              >
                查看完整决策依据
                <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </div>

        {/* 免责声明 */}
        <div className="text-center text-xs text-text-muted mb-20">
          <p>{data.disclaimer}</p>
          <p>如有不适，请停止训练并咨询专业医生。</p>
        </div>
      </div>

      {/* 反馈弹窗 */}
      {data && (
        <FeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ isOpen: false, type: '' })}
          recommendationId={data.recommendation.id}
          feedbackType={feedbackModal.type}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </Layout>
  )
}

export default Today
