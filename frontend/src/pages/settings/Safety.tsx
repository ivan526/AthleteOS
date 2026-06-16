import { useState } from 'react'
import { ArrowLeft, AlertTriangle, BellRing, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'

const SafetySettings = () => {
  const [formData, setFormData] = useState({
    highRiskAlert: true,
    painFeedbackProtection: true,
    acwrWarningThreshold: 1.2,
    autoReduceIntensity: true,
    restDayReminder: true,
    medicalDisclaimer: true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 提交保存
    alert('安全设置已保存')
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
          <h1 className="text-2xl font-bold text-text-primary mb-1">安全设置</h1>
          <p className="text-text-secondary">管理训练安全相关的提醒和保护机制</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 bg-yellow-50 border-yellow-100 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800">安全提示</p>
                <p className="text-sm text-yellow-700">
                  AthleteOS的安全机制仅为训练参考，不能替代专业医疗建议。如有不适，请立即停止训练并咨询医生。
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-status-warning/10 rounded-lg mt-0.5">
                    <BellRing size={20} className="text-status-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">高风险提醒</p>
                    <p className="text-sm text-text-secondary">当训练风险偏高时发出提醒</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.highRiskAlert}
                    onChange={(e) => setFormData({ ...formData, highRiskAlert: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-status-danger/10 rounded-lg mt-0.5">
                    <Shield size={20} className="text-status-danger" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">疼痛反馈保护</p>
                    <p className="text-sm text-text-secondary">反馈疼痛时自动调整为恢复训练</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.painFeedbackProtection}
                    onChange={(e) => setFormData({ ...formData, painFeedbackProtection: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <Shield size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">自动降低强度</p>
                    <p className="text-sm text-text-secondary">风险高时自动降低训练强度</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoReduceIntensity}
                    onChange={(e) => setFormData({ ...formData, autoReduceIntensity: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <BellRing size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">休息日提醒</p>
                    <p className="text-sm text-text-secondary">连续训练多日后提醒休息</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.restDayReminder}
                    onChange={(e) => setFormData({ ...formData, restDayReminder: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  ACWR 风险阈值
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="1.5"
                  step="0.05"
                  value={formData.acwrWarningThreshold}
                  onChange={(e) => setFormData({ ...formData, acwrWarningThreshold: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-text-secondary mt-1">
                  <span>1.0</span>
                  <span className="font-medium text-primary">{formData.acwrWarningThreshold.toFixed(2)}</span>
                  <span>1.5</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  ACWR超过此值时触发风险提醒，建议普通训练者设置为1.2左右
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">免责声明确认</p>
                  <p className="text-sm text-text-secondary">已阅读并理解医疗免责声明</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.medicalDisclaimer}
                    onChange={(e) => setFormData({ ...formData, medicalDisclaimer: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            保存设置
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default SafetySettings
