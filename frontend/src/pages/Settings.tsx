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
  Bot,
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

const llmProviderBaseUrls: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
}

const defaultSettings: UserSettings = {
  intervals_athlete_id: '',
  has_credentials: false,
  last_sync_at: null,
  garmin_email: '',
  garmin_auth_domain: 'garmin.com',
  has_garmin_credentials: false,
  garmin_last_sync_at: null,
  garmin_sync_status: 'not_connected',
  garmin_sync_message: '未配置 Garmin Connect',
  primary_data_source: 'intervals.icu',
  llm_provider: 'openai-compatible',
  llm_model: '',
  llm_base_url: '',
  llm_enabled: false,
  has_llm_api_key: false,
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
  const [savingLlm, setSavingLlm] = useState(false)
  const [garminEmail, setGarminEmail] = useState('')
  const [garminPassword, setGarminPassword] = useState('')
  const [garminAuthDomain, setGarminAuthDomain] = useState('garmin.com')
  const [garminMfaCode, setGarminMfaCode] = useState('')
  const [llmProvider, setLlmProvider] = useState('openai-compatible')
  const [llmModel, setLlmModel] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmEnabled, setLlmEnabled] = useState(false)

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
    setGarminAuthDomain(settingsData.garmin_auth_domain || 'garmin.com')
    setLlmProvider(settingsData.llm_provider || 'openai-compatible')
    setLlmModel(settingsData.llm_model || '')
    setLlmBaseUrl(settingsData.llm_base_url || '')
    setLlmEnabled(Boolean(settingsData.llm_enabled))
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
        garmin_auth_domain: garminAuthDomain,
      })
      setSettings(updated)
      setGarminEmail(updated.garmin_email || '')
      setGarminAuthDomain(updated.garmin_auth_domain || 'garmin.com')
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

  const handleSaveLlm = async () => {
    if (llmEnabled && !llmBaseUrl.trim()) {
      alert('启用 AI Coach 前请填写 Base URL，或选择带预设地址的 Provider。')
      return
    }
    if (llmEnabled && !llmModel.trim()) {
      alert('启用 AI Coach 前请填写模型名称。')
      return
    }
    if (llmEnabled && !settings?.has_llm_api_key && !llmApiKey) {
      alert('启用 AI Coach 前请填写 API Key。')
      return
    }
    try {
      setSavingLlm(true)
      const updated = await updateSettings({
        llm_provider: llmProvider,
        llm_model: llmModel.trim(),
        llm_base_url: llmBaseUrl.trim(),
        llm_api_key: llmApiKey || undefined,
        llm_enabled: llmEnabled,
      })
      setSettings(updated)
      setLlmApiKey('')
    } catch (err: any) {
      console.error('保存 LLM 配置失败', err)
      alert(`保存失败：${err.message || '请检查 LLM 配置'}`)
    } finally {
      setSavingLlm(false)
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
                <h3 className="font-medium text-text-primary">
                  Intervals.icu 辅助数据源
                </h3>
                <p className="text-sm text-text-secondary">
                  {settings.has_credentials
                    ? `已连接 · 双源合计 ${syncStatus.activitiesCount} 条训练记录`
                    : '未连接，可用于补充 TSS / NP / IF'}
                </p>
                {settings.has_credentials && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    上次同步：{syncStatus.lastSync}
                  </p>
                )}
              </div>
            </div>
            {settings.has_credentials ? (
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
              <h3 className="font-medium text-text-primary">
                Garmin 中国区主数据源
              </h3>
              <p className="text-sm text-text-secondary">
                {settings.has_garmin_credentials
                  ? `已配置 · ${settings.garmin_sync_message}`
                  : '配置后同步活动、睡眠、HRV、静息心率和训练准备度'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {settings.primary_data_source === 'garmin.cn' ? '当前主数据源 · ' : ''}
                上次同步：{formatDateTime(settings.garmin_last_sync_at)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Garmin 服务区域</span>
              <select
                value={garminAuthDomain}
                onChange={(event) => setGarminAuthDomain(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
              >
                <option value="garmin.cn">中国区（garmin.cn）</option>
                <option value="garmin.com">国际区（garmin.com）</option>
              </select>
            </label>
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

        <div className="card mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary">AI Coach / LLM 配置</h3>
                <p className="text-sm text-text-secondary">
                  {settings.llm_enabled
                    ? `已启用 · ${settings.llm_provider}${settings.llm_model ? ` · ${settings.llm_model}` : ''}`
                    : '未启用，仅使用规则引擎解释'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  API Key：{settings.has_llm_api_key ? '已保存' : '未保存'}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  LLM 仅用于解释、总结和问答，不会修改训练负荷或覆盖安全规则。
                </p>
              </div>
            </div>
            <button
              onClick={() => setLlmEnabled((value) => !value)}
              className={`relative h-7 w-12 rounded-full transition-colors ${llmEnabled ? 'bg-primary' : 'bg-border'}`}
              aria-pressed={llmEnabled}
              aria-label="启用 AI Coach LLM"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${llmEnabled ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Provider</span>
              <select
                value={llmProvider}
                onChange={(event) => {
                  const provider = event.target.value
                  const oldPreset = llmProviderBaseUrls[llmProvider]
                  setLlmProvider(provider)
                  if (!llmBaseUrl.trim() || llmBaseUrl === oldPreset) {
                    setLlmBaseUrl(llmProviderBaseUrls[provider] || '')
                  }
                }}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
              >
                <option value="openai-compatible">OpenAI-compatible</option>
                <option value="volcengine">豆包 / 火山方舟</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="local">Local / Self-hosted</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Base URL</span>
              <input
                value={llmBaseUrl}
                onChange={(event) => setLlmBaseUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder="https://api.example.com/v1"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Model</span>
              <input
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder="输入模型名称"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">API Key</span>
              <input
                value={llmApiKey}
                onChange={(event) => setLlmApiKey(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary outline-none focus:border-primary"
                placeholder={settings.has_llm_api_key ? '留空则保持原 Key' : '输入 API Key'}
                type="password"
                autoComplete="off"
              />
            </label>
          </div>

          <button
            onClick={handleSaveLlm}
            disabled={savingLlm}
            className="mt-4 w-full btn-primary disabled:opacity-50"
          >
            {savingLlm ? '保存中...' : '保存 LLM 配置'}
          </button>
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
