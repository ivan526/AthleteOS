import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Clock, Activity, AlertTriangle, Play, Settings, Pause, RotateCcw, Check } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import FeedbackModal from '../components/FeedbackModal'
import Modal from '../components/Modal'
import { getTodayData, type WorkoutRecommendation } from '../lib/api'

// 训练详情响应接口
interface RecommendationResponse extends WorkoutRecommendation {
  purpose: string
  tips: string
  notes: string
}

const WorkoutDetail = () => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean
    type: string
  }>({ isOpen: false, type: '' })
  const [showTimer, setShowTimer] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchRecommendation()
  }, [id])

  const fetchRecommendation = async () => {
    try {
      setLoading(true)
      setError(null)
      // 从今日训练接口获取推荐数据
      const todayData = await getTodayData()
      const sportCopy: Record<string, { purpose: string; tips: string; notes: string }> = {
        running: {
          purpose: '提升有氧耐力、跑步经济性和配速维持能力',
          tips: '保持目标呼吸节奏和动作稳定，高强度段也不要失去跑姿控制。',
          notes: '如果出现疼痛或动作明显变形，降低配速或停止训练。',
        },
        cycling: {
          purpose: '提升骑行有氧耐力、持续输出能力和踏频效率',
          tips: '保持稳定踏频与圆顺踩踏，强度以可持续输出为准。',
          notes: '户外骑行注意路况、补水与能量补给，疲劳时避免勉强冲刺。',
        },
        swimming: {
          purpose: '提升游泳有氧耐力、划水效率和呼吸节奏',
          tips: '动作质量优先于速度，保持流线型和稳定呼吸。',
          notes: '避免独自进行高强度水上训练；出现胸闷、眩晕或抽筋立即停止。',
        },
        strength: {
          purpose: '提升核心稳定、动作控制和基础力量',
          tips: '保留动作余量，优先保证姿势与关节排列，不追求力竭。',
          notes: '疼痛不是正常训练刺激；出现锐痛时立即停止对应动作。',
        },
      }
      const copy = sportCopy[todayData.recommendation.sport] ?? sportCopy.running
      const recommendation: RecommendationResponse = {
        ...todayData.recommendation,
        ...copy,
      }
      setData(recommendation)
    } catch (err: any) {
      setError(err.message || '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustWorkout = () => {
    setFeedbackModal({
      isOpen: true,
      type: 'adjust_workout'
    })
  }

  const handleFeedbackSuccess = (_result: any) => {
    setFeedbackModal({ isOpen: false, type: '' })
    // 调整成功后重新加载数据
    fetchRecommendation()
  }

  // 格式化时间为 HH:MM:SS
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 开始/暂停计时器
  const toggleTimer = () => {
    if (isRunning) {
      // 暂停
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    } else {
      // 开始
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    setIsRunning(!isRunning)
  }

  // 重置计时器
  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setElapsedTime(0)
    setIsRunning(false)
  }

  // 完成训练
  const finishWorkout = () => {
    resetTimer()
    setShowTimer(false)
    // 跳转到反馈页面或者提交完成
    alert('训练完成！真棒！')
    navigate('/today')
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回</span>
          </Link>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background-page p-4">
        <div className="mb-6">
          <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回</span>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-text-secondary">{error || '数据加载失败'}</p>
          <button className="btn-primary" onClick={fetchRecommendation}>
            重新加载
          </button>
        </div>
      </div>
    )
  }

  const getIntensityText = (intensity: string) => {
    switch (intensity) {
      case 'easy':
      case 'low': return '低强度'
      case 'moderate': return '中等强度'
      case 'high': return '高强度'
      default: return '中等强度'
    }
  }

  return (
    <div className="min-h-screen bg-background-page">
      <div className="p-4 pb-32">
        {/* 顶部导航 */}
        <div className="mb-6">
          <Link to="/today" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回今日训练</span>
          </Link>
        </div>

        {/* 训练信息卡片 */}
        <div className="card mb-4 text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-4">{data.title}</h1>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <span className="tag flex items-center gap-1">
              <Clock size={14} />
              {data.duration_minutes} 分钟
            </span>
            <span className="tag flex items-center gap-1">
              <Activity size={14} />
              TSS {data.expected_tss}
            </span>
            <span className="tag">
              {getIntensityText(data.intensity)}
            </span>
          </div>

          <div className="p-4 bg-background-weak rounded-xl mb-4">
            <h3 className="font-medium text-text-primary mb-2">训练目的</h3>
            <p className="text-text-secondary">{data.purpose}</p>
          </div>
        </div>

        {/* 训练结构 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">建议执行</h3>
          <ul className="space-y-3">
            {data.structure.warmup && (
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium text-text-primary">热身</p>
                  <p className="text-text-secondary">{data.structure.warmup}</p>
                </div>
              </li>
            )}
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium">
                {data.structure.warmup ? '2' : '1'}
              </div>
              <div>
                <p className="font-medium text-text-primary">主训练</p>
                <p className="text-text-secondary">{data.structure.main_set}</p>
              </div>
            </li>
            {data.structure.cooldown && (
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium">
                  {data.structure.warmup ? '3' : '2'}
                </div>
                <div>
                  <p className="font-medium text-text-primary">冷身</p>
                  <p className="text-text-secondary">{data.structure.cooldown}</p>
                </div>
              </li>
            )}
          </ul>
        </div>

        {/* 强度提示 */}
        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">强度提示</h3>
          <p className="text-text-secondary">{data.tips}</p>
        </div>

        {/* 注意事项 */}
        <div className="card mb-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={20} className="text-status-warning mt-0.5 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-text-primary">注意事项</h3>
          </div>
          <p className="text-text-secondary">{data.notes}</p>
        </div>
      </div>

      {/* 底部固定按钮 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-page border-t border-border/60 pb-safe">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            className="flex-1 btn-secondary flex items-center justify-center gap-2"
            onClick={handleAdjustWorkout}
          >
            <Settings size={18} />
            调整训练
          </button>
          <button
            className="flex-1 btn-primary flex items-center justify-center gap-2"
            onClick={() => setShowTimer(true)}
          >
            <Play size={18} />
            开始训练
          </button>
        </div>
      </div>

      {/* 训练计时弹窗 */}
      <Modal
        isOpen={showTimer}
        onClose={() => {
          if (isRunning) {
            if (confirm('训练正在进行中，确定要退出吗？')) {
              resetTimer()
              setShowTimer(false)
            }
          } else {
            setShowTimer(false)
          }
        }}
        hideCloseButton={true}
        title="训练中"
      >
        <div className="text-center py-8">
          {/* 计时显示 */}
          <div className="mb-8">
            <div className="text-6xl font-bold text-text-primary mb-2 font-mono">
              {formatTime(elapsedTime)}
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="tag">
                <Clock size={14} className="mr-1" />
                目标 {data?.duration_minutes} 分钟
              </span>
              <span className="tag">
                已完成 {Math.min(100, Math.round((elapsedTime / (data?.duration_minutes || 60) / 60) * 100))}%
              </span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="w-full bg-gray-100 rounded-full h-3 mb-8 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((elapsedTime / (data?.duration_minutes || 60) / 60) * 100))}%`
              }}
            ></div>
          </div>

          {/* 当前阶段提示 */}
          <div className="card mb-8">
            <h4 className="font-medium text-text-primary mb-2">当前阶段</h4>
            <p className="text-text-secondary">
              {elapsedTime < 10 * 60
                ? data?.structure.warmup || '热身阶段'
                : elapsedTime < (data?.duration_minutes || 60) * 60 - 10 * 60
                ? data?.structure.main_set || '主训练阶段'
                : data?.structure.cooldown || '冷身阶段'}
            </p>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <button
              onClick={resetTimer}
              className="w-14 h-14 rounded-full bg-background-weak flex items-center justify-center text-text-secondary hover:bg-background-weak/80 transition-colors"
            >
              <RotateCcw size={24} />
            </button>
            <button
              onClick={toggleTimer}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
                isRunning
                  ? 'bg-status-warning text-white hover:bg-status-warning/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {isRunning ? <Pause size={32} /> : <Play size={32} />}
            </button>
            <button
              onClick={finishWorkout}
              className="w-14 h-14 rounded-full bg-status-success flex items-center justify-center text-white hover:bg-status-success/90 transition-colors"
            >
              <Check size={24} />
            </button>
          </div>

          <p className="text-sm text-text-secondary">
            {isRunning ? '训练进行中，加油！' : '点击开始按钮开始训练'}
          </p>
        </div>
      </Modal>

      {/* 反馈弹窗 */}
      {data && (
        <FeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ isOpen: false, type: '' })}
          recommendationId={data.id}
          feedbackType={feedbackModal.type}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </div>
  )
}

export default WorkoutDetail
