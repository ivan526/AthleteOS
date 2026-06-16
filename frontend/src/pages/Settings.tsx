import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Link2,
  User,
  Flag,
  Shield,
  Ruler,
  Info,
  ChevronRight,
  RefreshCw as Sync,
  BellRing,
  AlertCircle,
} from 'lucide-react'
import Layout from '../components/Layout'
import { getSyncStatus, syncIntervals } from '../lib/api'

interface SyncStatus {
  connected: boolean
  lastSync: string
  activitiesCount: number
}

interface UserSettings {
  primarySport: string
  weeklyAvailableDays: number
  preferredSports: string[]
  highRiskAlert: boolean
  painFeedbackProtection: boolean
  paceUnit: string
  distanceUnit: string
}

const Settings = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 加载同步状态和设置
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // 获取同步状态
        const syncData = await getSyncStatus()
        setSyncStatus({
          connected: syncData.syncStatus === 'connected',
          lastSync: syncData.lastSyncAt ? new Date(syncData.lastSyncAt).toLocaleString('zh-CN') : '未同步',
          activitiesCount: 0, // TODO: 从API获取活动数量
        })

        // TODO: 获取用户设置API
        setSettings({
          primarySport: '跑步',
          weeklyAvailableDays: 5,
          preferredSports: ['跑步', '骑行'],
          highRiskAlert: true,
          painFeedbackProtection: true,
          paceUnit: 'min/km',
          distanceUnit: 'km',
        })
      } catch (err) {
        console.error('加载设置失败', err)
        // 默认值
        setSyncStatus({
          connected: false,
          lastSync: '未同步',
          activitiesCount: 0,
        })
        setSettings({
          primarySport: '跑步',
          weeklyAvailableDays: 5,
          preferredSports: ['跑步', '骑行'],
          highRiskAlert: true,
          painFeedbackProtection: true,
          paceUnit: 'min/km',
          distanceUnit: 'km',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSync = async () => {
    if (!syncStatus) return

    try {
      setSyncing(true)
      setSyncStatus({ ...syncStatus, lastSync: '同步中...' })

      // 触发同步
      await syncIntervals(true)

      // 刷新同步状态
      const syncData = await getSyncStatus()
      setSyncStatus({
        connected: syncData.syncStatus === 'connected',
        lastSync: '刚刚',
        activitiesCount: syncStatus.activitiesCount + 1,
      })
    } catch (err: any) {
      console.error('同步失败', err)
      alert(`同步失败：${err.message || '请稍后重试'}`)
      setSyncStatus({ ...syncStatus, lastSync: '同步失败' })
    } finally {
      setSyncing(false)
    }
  }

  if (loading || !syncStatus || !settings) {
    return (
      <Layout>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-1">设置</h1>
            <p className="text-text-secondary">管理你的账户和应用偏好</p>
          </div>
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-text-secondary">加载中...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">设置</h1>
          <p className="text-text-secondary">管理你的账户和应用偏好</p>
        </div>

        {/* 数据连接 */}
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-info/10 rounded-lg">
                <Link2 size={20} className="text-status-info" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary">数据连接</h3>
                <p className="text-sm text-text-secondary">
                  {syncStatus.connected
                    ? `已连接 Intervals.icu · 已同步 ${syncStatus.activitiesCount} 条记录`
                    : '未连接数据源'}
                </p>
                {syncStatus.connected && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    上次同步：{syncStatus.lastSync}
                  </p>
                )}
              </div>
            </div>
            {syncStatus.connected ? (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-2 bg-background-weak rounded-lg flex items-center gap-1 text-primary text-sm font-medium hover:bg-background-weak/80 transition-colors disabled:opacity-50"
              >
                <Sync size={16} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? '同步中...' : '同步'}</span>
              </button>
            ) : (
              <Link to="/connect-intervals" className="btn-primary text-sm px-3 py-1.5">
                连接
              </Link>
            )}
          </div>
        </div>

        {/* 设置菜单 */}
        <div className="space-y-2 mb-6">
          <Link to="/settings/profile" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">个人资料</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>

          <Link to="/settings/preferences" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BellRing size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">训练偏好</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>

          <Link to="/settings/goals" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Flag size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">训练目标</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>

          <Link to="/settings/safety" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">安全设置</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>

          <Link to="/settings/units" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Ruler size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">单位设置</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>

          <Link to="/settings/about" className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/60 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Info size={20} className="text-primary" />
              </div>
              <span className="font-medium text-text-primary">关于</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>
        </div>

        {/* 风险提示 */}
        <div className="card bg-red-50 border-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle size={20} className="text-status-danger mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-text-primary mb-1">免责声明</h4>
              <p className="text-sm text-text-secondary">
                AthleteOS 提供的训练建议仅供参考，不构成医疗建议。训练前请确保身体状况良好，如有不适请立即停止并咨询专业医生。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Settings
