import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getSettings, updateSettings } from '../../lib/api'

const PreferencesSettings = () => {
  const [formData, setFormData] = useState({
    primarySport: 'running',
    weeklyAvailableDays: 5,
    defaultDuration: 60,
    preferredSports: ['running', 'cycling'],
    intensityPreference: 'moderate',
    avoidHighIntensity: false,
    restDayPreference: 'active',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setFormData((current) => ({
          ...current,
          primarySport: settings.primary_sport,
          weeklyAvailableDays: settings.weekly_available_days,
          preferredSports: settings.preferred_sports?.length
            ? settings.preferred_sports
            : ['running', 'cycling'],
        }))
      })
      .catch((error) => {
        alert(`加载训练偏好失败: ${error.message}`)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const preferredSports = formData.preferredSports
      await updateSettings({
        primary_sport: formData.primarySport,
        weekly_available_days: formData.weeklyAvailableDays,
        preferred_sports: preferredSports,
      })
      setFormData((current) => ({ ...current, preferredSports }))
      alert('训练偏好已保存，今日页只会显示这些运动项目')
    } catch (error: any) {
      alert(`保存失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleSport = (sport: string) => {
    if (formData.preferredSports.includes(sport)) {
      if (formData.preferredSports.length > 1) {
        const nextSports = formData.preferredSports.filter(s => s !== sport)
        setFormData({
          ...formData,
          preferredSports: nextSports,
          primarySport:
            formData.primarySport === sport ? nextSports[0] : formData.primarySport,
        })
      }
    } else {
      setFormData({
        ...formData,
        preferredSports: [...formData.preferredSports, sport]
      })
    }
  }

  return (
    <Layout showNav={false}>
      <div className="p-4 pb-20">
        <div className="mb-6">
          <Link to="/settings" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回设置</span>
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">训练偏好</h1>
          <p className="text-text-secondary">个性化你的训练推荐设置</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  主要运动项目
                </label>
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
                        formData.primarySport === sport.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="primarySport"
                        value={sport.value}
                        checked={formData.primarySport === sport.value}
                        onChange={(e) => setFormData({
                          ...formData,
                          primarySport: e.target.value,
                          preferredSports: formData.preferredSports.includes(e.target.value)
                            ? formData.preferredSports
                            : [...formData.preferredSports, e.target.value],
                        })}
                        className="sr-only"
                      />
                      <div className="text-2xl mb-1">{sport.emoji}</div>
                      <div className="font-medium text-text-primary">{sport.label}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  今日建议运动项目（可多选）
                </label>
                <p className="text-xs text-text-secondary mb-2">
                  今日训练页只会展示这里选中的运动类型。
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'running', label: '跑步', emoji: '🏃' },
                    { value: 'cycling', label: '骑行', emoji: '🚴' },
                    { value: 'swimming', label: '游泳', emoji: '🏊' },
                    { value: 'strength', label: '力量训练', emoji: '💪' },
                  ].map((sport) => (
                    <label
                      key={sport.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.preferredSports.includes(sport.value)
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.preferredSports.includes(sport.value)}
                        onChange={() => toggleSport(sport.value)}
                        className="sr-only"
                      />
                      <div className="text-xl mb-1">{sport.emoji}</div>
                      <div className="font-medium text-text-primary text-sm">{sport.label}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  每周可训练天数
                </label>
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={formData.weeklyAvailableDays}
                  onChange={(e) => setFormData({ ...formData, weeklyAvailableDays: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-text-secondary mt-1">
                  <span>1天</span>
                  <span className="font-medium text-primary">{formData.weeklyAvailableDays} 天</span>
                  <span>7天</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  默认训练时长 (分钟)
                </label>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="15"
                  value={formData.defaultDuration}
                  onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-text-secondary mt-1">
                  <span>30分钟</span>
                  <span className="font-medium text-primary">{formData.defaultDuration} 分钟</span>
                  <span>3小时</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  强度偏好
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'low', label: '低强度', desc: '轻松为主' },
                    { value: 'moderate', label: '中等强度', desc: '均衡发展' },
                    { value: 'high', label: '高强度', desc: '挑战极限' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.intensityPreference === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intensityPreference"
                        value={option.value}
                        checked={formData.intensityPreference === option.value}
                        onChange={(e) => setFormData({ ...formData, intensityPreference: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">避免高强度训练</p>
                  <p className="text-sm text-text-secondary">系统不会推荐高强度训练</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.avoidHighIntensity}
                    onChange={(e) => setFormData({ ...formData, avoidHighIntensity: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  休息日偏好
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'active', label: '主动恢复', desc: '推荐轻度活动' },
                    { value: 'complete', label: '完全休息', desc: '不安排任何训练' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.restDayPreference === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restDayPreference"
                        value={option.value}
                        checked={formData.restDayPreference === option.value}
                        onChange={(e) => setFormData({ ...formData, restDayPreference: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading || saving}>
            {loading ? '加载中...' : saving ? '保存中...' : '保存更改'}
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default PreferencesSettings
