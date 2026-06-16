import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, Check, AlertCircle } from 'lucide-react'
import { syncIntervals } from '../lib/api'

const ConnectIntervals = () => {
  const navigate = useNavigate()
  const [athleteId, setAthleteId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [step, setStep] = useState(1) // 1: 输入信息, 2: 同步中, 3: 完成, 4: 错误
  const [syncProgress, setSyncProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!athleteId.trim() || !apiKey.trim()) {
      setErrorMessage('请输入运动员ID和API密钥')
      return
    }

    setStep(2)
    setErrorMessage('')

    try {
      // 模拟同步进度
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 500)

      // 触发同步
      void syncIntervals(true)

      clearInterval(progressInterval)
      setSyncProgress(100)

      setTimeout(() => {
        setStep(3)
        setTimeout(() => {
          navigate('/onboarding/model-building')
        }, 2000)
      }, 1000)
    } catch (err: any) {
      setStep(4)
      setErrorMessage(err.message || '同步失败，请检查输入信息是否正确')
    }
  }

  const handleRetry = () => {
    setStep(1)
    setErrorMessage('')
    setSyncProgress(0)
  }

  return (
    <div className="min-h-screen bg-background-page p-4">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft size={20} />
          <span>返回</span>
        </Link>
      </div>

      <div className="max-w-md mx-auto pt-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-background-weak rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={40} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">连接 Intervals.icu</h1>
          <p className="text-text-secondary max-w-sm mx-auto">
            连接你的 Intervals.icu 账户，同步训练数据，获取个性化训练建议
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label htmlFor="athleteId" className="block text-sm font-medium text-text-primary mb-1">
                    运动员 ID
                  </label>
                  <input
                    id="athleteId"
                    type="text"
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                    placeholder="例如: i212288"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-text-primary mb-1">
                    API 密钥
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="在 Intervals.icu 设置页面获取"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>

                <div className="p-3 bg-background-weak rounded-xl">
                  <p className="text-sm text-text-secondary">
                    <Info size={14} className="inline-block mr-1 mb-1" />
                    如何获取这些信息？在 Intervals.icu 网站进入 Settings → API Keys 即可查看你的运动员ID和API密钥。
                  </p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-status-danger flex items-center gap-1">
                  <AlertCircle size={16} />
                  {errorMessage}
                </p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              连接并同步数据
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="card text-center">
            <div className="py-8">
              <div className="mb-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">正在同步数据</h3>
              <p className="text-text-secondary mb-6">正在从 Intervals.icu 同步你的训练数据，请稍候...</p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-text-secondary">{syncProgress}%</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card text-center">
            <div className="py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-status-success" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">连接成功</h3>
              <p className="text-text-secondary mb-6">
                数据同步完成！即将跳转到今日训练页面...
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card text-center">
            <div className="py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-status-danger" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">连接失败</h3>
              <p className="text-text-secondary mb-6">{errorMessage}</p>
              <button onClick={handleRetry} className="btn-primary w-full">
                重新输入
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectIntervals
