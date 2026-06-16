import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Layout from '../components/Layout'

const DebugState = () => {
  const [stateData, setStateData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'state' | 'decision' | 'raw'>('state')

  const fetchState = async () => {
    try {
      setLoading(true)
      // 调用调试API获取原始状态数据
      const response = await fetch('/api/state/daily')
      const data = await response.json()
      setStateData(data)
    } catch (err) {
      console.error('获取状态失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchState()
  }, [])

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  return (
    <Layout showNav={false}>
      <div className="p-4 pb-20">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-text-primary">调试 - 状态详情</h1>
            <button
              onClick={fetchState}
              disabled={loading}
              className="p-2 bg-background-weak rounded-lg flex items-center gap-1 text-primary text-sm font-medium hover:bg-background-weak/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                此页面仅用于开发和调试，包含技术细节，普通用户无需访问。
              </p>
            </div>
          </div>
        </div>

        {/* 标签切换 */}
        <div className="flex bg-white rounded-xl p-1 mb-4 border border-border/60">
          <button
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'state'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('state')}
          >
            运动员状态
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'decision'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('decision')}
          >
            决策数据
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'raw'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('raw')}
          >
            原始数据
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-text-secondary">加载中...</p>
          </div>
        )}

        {!loading && stateData && (
          <div className="card">
            <div className="p-4 overflow-x-auto">
              <pre className="text-xs text-text-primary bg-background-weak p-4 rounded-lg overflow-x-auto">
                {activeTab === 'state' && formatJSON({
                  dataLevel: stateData.dataLevel,
                  dataQuality: stateData.dataQuality,
                  fitness: stateData.fitness,
                  fatigue: stateData.fatigue,
                  form: stateData.form,
                  sleepScore: stateData.sleepScore,
                  hrvScore: stateData.hrvScore,
                  acwr: stateData.acwr,
                  monotony: stateData.monotony,
                  trainingCapacity: stateData.trainingCapacity,
                  trainingRisk: stateData.trainingRisk,
                  hardSafety: stateData.hardSafety,
                  confidence: stateData.confidence,
                })}
                {activeTab === 'decision' && formatJSON({
                  dayType: stateData.dayType,
                  recommendation: stateData.recommendation,
                  decision: stateData.decision,
                  alternatives: stateData.alternatives,
                })}
                {activeTab === 'raw' && formatJSON(stateData)}
              </pre>
            </div>
          </div>
        )}

        {/* 快捷操作 */}
        <div className="card mt-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">调试工具</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary h-auto py-3 text-sm">
              生成Mock数据
            </button>
            <button className="btn-secondary h-auto py-3 text-sm">
              重新计算今日状态
            </button>
            <button className="btn-secondary h-auto py-3 text-sm">
              模拟用户反馈
            </button>
            <button className="btn-secondary h-auto py-3 text-sm">
              导出状态JSON
            </button>
          </div>
        </div>

        {/* 版本信息 */}
        <div className="mt-6 text-center text-xs text-text-muted">
          <p>AthleteOS MVP v1.1.0</p>
          <p>Build 20260616</p>
        </div>
      </div>
    </Layout>
  )
}

export default DebugState
