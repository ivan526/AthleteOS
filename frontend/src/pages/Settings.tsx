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
  Watch,
  KeyRound,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  getSettings,
  getSyncStatus,
  syncGarmin,
  syncIntervals,
  updateSettings,
  type UserSettings,
} from '../lib/api'

interface SyncStatus {
  connected: boolean
  lastSync: string
  activitiesCount: number
}

const sportLabel: Record<string, string> = {
  running: '跑步',
  cycling: '骑行',
  swimming: '游泳',
  strength: '力量训练',
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '未同步'
  return new Date(value).toLocaleString('zh-CN')
}

const defaultSettings: UserSettings = {
  intervals_athlete_id: '',
  has_credentials: false,
  last_sync_at: null,
  garmin_email: '',
  has_garmin_credentials: false,
  garmin_last_sync_at: null,
  garmin_sync_status: 'not_connected',
  garmin_sync_message: '未配置 Garmin Connect',
  primary_sport: 'running',
  weekly_available_days: 5,
  preferred_sports: ['running', 'cycling'],
  primary_goal: '半马 1:40',
  goal_date: '2026-11-15',
  goal_time: 6000,
}

const Settings = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [savingGarmin, setSavingGarmin] = useState(false)
  const [syncingGarmin, setSyncingGarmin] = useState(false)
  const [garminEmail, setGarminEmail] = useState('')
  const [garminPassword, setGarminPassword] = useState('')
  const [garminMfaCode, setGarminMfaCode] = useState('')

  const refreshData = async () => {
    const [syncData, settingsData] = await Promise.all([
      getSyncStatus(),
      getSettings(),
    ])

    setSyncStatus({
      connected: syncData.connected || !['not_connected', 'failed'].includes(syncData.syncStatus),
      lastSync: formatDateTime(syncData.lastSyncAt),
      activitiesCount: syncData.activityCount || 0,
    })
    setSettings(settingsData)
    setGarminEmail(settingsData.garmin_email || '')
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        await refreshData()
      } catch (err) {
        console.error('加载设置失败', err)
        setSyncStatus({
          connected: false,
          lastSync: '未同步',
          activitiesCount: 0,
        })
        setSettings(defaultSettings)
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
      const result = await syncIntervals(true)
      if (result?.success === false) {
        throw new Error(result.error || '同步失败')
      }
      await refreshData()
    } catch (err: any) {
      console.error('同步失败', err)
      alert(`同步失败：${err.message || '请稍后重试'}`)
      setSyncStatus({ ...syncStatus, lastSync: '同步失败' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveGarmin = async () => {
    try {
      setSavingGarmin(true)
      const updated = await updateSettings({
        garmin_email: garminEmail.trim(),
        garmin_password: garminPassword || undefined,
      })
      setSettings(updated)
      setGarminEmail(updated.garmin_email || '')
      setGarminPassword('')
    } catch (err: any) {
      console.error('保存 Garmin 失败', err)
      alert(`保存失败：${err.message || '请检查账号信息'}`)
    } finally {
      setSavingGarmin(false)
    }
  }

  const handleGarminSync = async () => {
    try {
      setSyncingGarmin(true)
      const result = await syncGarmin(true, garminMfaCode.trim() || undefined)
      if (result?.success === false) {
        throw new Error(result.error || 'Garmin HRV 同步失败')
      }
      setGarminMfaCode('')
      await refreshData()
    } catch (err: any) {
      console.error('Garmin 同步失败', err)
      alert(`Garmin 同步失败：${err.message || '请稍后重试'}`)
      await refreshData().catch(() => undefined)
    } finally {
      setSyncingGarmin(false)
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

        <div className="card mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-status-info/10 rounded-lg">
                <Link2 size={20} className="text-status-info" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-text-primary">Intervals.icu 数据连接</h3>
                <p className="text-sm text-text-secondary">
                  {syncStatus.connected
                    ? `已连接 · 已同步 ${syncStatus.activitiesCount} 条训练记录`
                    : '未连接主数据源'}
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
                <span>{syncing ? '同步中' : '同步'}</span>
              </button>
            ) : (
              <Link to="/connect/intervals" className="btn-primary text-sm px-3 py-1.5">
                连接
              </Link>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Watch size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Garmin HRV 补充数据源</h3>
              <p className="text-sm text-text-secondary">
                {settings.has_garmin_credentials
                  ? `已配置 · ${settings.garmin_sync_message}`
                  : '可选配置，用于补充 Intervals.icu 缺失的 HRV'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                上次同步：{formatDateTime(settings.garmin_last_sync_at)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Garmin 邮箱</span>
              <input
                value={garminEmail}
                onChange={(event) => setGarminEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder="name@example.com"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Garmin 密码</span>
              <input
                value={garminPassword}
                onChange={(event) => setGarminPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder={settings.has_garmin_credentials ? '留空则保持原密码' : '输入 Garmin Connect 密码'}
                type="password"
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">MFA 验证码</span>
              <input
                value={garminMfaCode}
                onChange={(event) => setGarminMfaCode(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder="需要二次验证时填写"
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveGarmin}
              disabled={savingGarmin || !garminEmail.trim()}
              className="flex-1 border border-primary text-primary rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {savingGarmin ? '保存中...' : '保存配置'}
            </button>
            <button
              onClick={handleGarminSync}
              disabled={syncingGarmin || !settings.has_garmin_credentials}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingGarmin ? <Sync size={16} className="animate-spin" /> : <KeyRound size={16} />}
              <span>{syncingGarmin ? '同步中...' : '同步 HRV'}</span>
            </button>
          </div>
        </div>

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
              <div>
                <span className="font-medium text-text-primary">训练偏好</span>
                <p className="text-xs text-text-secondary">{sportLabel[settings.primary_sport] ?? settings.primary_sport} · 每周 {settings.weekly_available_days} 天</p>
              </div>
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
