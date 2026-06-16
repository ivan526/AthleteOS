import { useState } from 'react'
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

const Settings = () => {
  const [syncStatus, setSyncStatus] = useState({
    connected: true,
    lastSync: '今天 08:20',
    activitiesCount: 53,
  })

  const [settings] = useState({
    primarySport: '跑步',
    weeklyAvailableDays: 5,
    preferredSports: ['跑步', '骑行'],
    highRiskAlert: true,
    painFeedbackProtection: true,
    paceUnit: 'min/km',
    distanceUnit: 'km',
  })

  const handleSync = async () => {
    try {
      // 触发同步
      setSyncStatus({ ...syncStatus, lastSync: '同步中...' })
      // 这里调用同步API
      setTimeout(() => {
        setSyncStatus({
          ...syncStatus,
          lastSync: '刚刚',
          activitiesCount: syncStatus.activitiesCount + 1,
        })
      }, 2000)
    } catch (err) {
      console.error('同步失败', err)
    }
  }

  return (
    <Layout>
      <div className="p-4">
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
                className="p-2 bg-background-weak rounded-lg flex items-center gap-1 text-primary text-sm font-medium hover:bg-background-weak/80 transition-colors"
              >
                <Sync size={16} />
                <span>同步</span>
              </button>
            ) : (
              <Link
                to="/connect/intervals"
                className="p-2 bg-primary/10 rounded-lg text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                连接
              </Link>
            )}
          </div>
        </div>

        {/* 设置列表 */}
        <div className="space-y-3 mb-20">
          {/* 个人资料 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/profile"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">个人资料</h3>
                  <p className="text-sm text-text-secondary">管理你的个人信息</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>

          {/* 训练偏好 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/preferences"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">训练偏好</h3>
                  <p className="text-sm text-text-secondary">
                    主要项目：{settings.primarySport} · 每周可训练 {settings.weeklyAvailableDays} 天
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>

          {/* 目标设置 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/goals"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Flag size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">目标设置</h3>
                  <p className="text-sm text-text-secondary">设置你的运动目标</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>

          {/* 安全设置 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/safety"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-status-warning/10 rounded-lg">
                  <Shield size={20} className="text-status-warning" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">安全设置</h3>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    {settings.highRiskAlert && (
                      <span className="flex items-center gap-0.5">
                        <BellRing size={12} />
                        高风险提醒
                      </span>
                    )}
                    {settings.painFeedbackProtection && (
                      <span className="flex items-center gap-0.5">
                        <AlertCircle size={12} />
                        疼痛保护
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>

          {/* 单位设置 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/units"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Ruler size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">单位设置</h3>
                  <p className="text-sm text-text-secondary">
                    配速：{settings.paceUnit} · 距离：{settings.distanceUnit}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>

          {/* 关于 */}
          <div className="card p-0 overflow-hidden">
            <Link
              to="/settings/about"
              className="flex items-center justify-between p-4 hover:bg-background-weak/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Info size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary">关于 AthleteOS</h3>
                  <p className="text-sm text-text-secondary">版本 1.1.0 (MVP)</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-secondary" />
            </Link>
          </div>
        </div>

        {/* 免责声明 */}
        <div className="text-center text-xs text-text-muted mb-8">
          <p>AthleteOS 提供训练建议仅供参考，不构成医疗建议。</p>
          <p>如有不适，请停止训练并咨询专业医生。</p>
        </div>
      </div>
    </Layout>
  )
}

export default Settings
