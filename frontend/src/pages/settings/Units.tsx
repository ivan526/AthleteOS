import { useState } from 'react'
import { ArrowLeft, Ruler } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'

const UnitsSettings = () => {
  const [formData, setFormData] = useState({
    distance: 'km',
    pace: 'min_km',
    weight: 'kg',
    height: 'cm',
    temperature: 'celsius',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 提交保存
    alert('单位设置已保存')
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
          <h1 className="text-2xl font-bold text-text-primary mb-1">单位设置</h1>
          <p className="text-text-secondary">自定义应用内使用的计量单位</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  距离单位
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'km', label: '公里 (km)', desc: '公制' },
                    { value: 'mile', label: '英里 (mile)', desc: '英制' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.distance === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="distance"
                        value={option.value}
                        checked={formData.distance === option.value}
                        onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  配速单位
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'min_km', label: '分/公里', desc: '每公里耗时' },
                    { value: 'min_mile', label: '分/英里', desc: '每英里耗时' },
                    { value: 'kmh', label: '公里/小时', desc: '公制速度' },
                    { value: 'mph', label: '英里/小时', desc: '英制速度' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.pace === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pace"
                        value={option.value}
                        checked={formData.pace === option.value}
                        onChange={(e) => setFormData({ ...formData, pace: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  重量单位
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'kg', label: '公斤 (kg)', desc: '公制' },
                    { value: 'lb', label: '磅 (lb)', desc: '英制' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.weight === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="weight"
                        value={option.value}
                        checked={formData.weight === option.value}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  身高单位
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cm', label: '厘米 (cm)', desc: '公制' },
                    { value: 'ft_in', label: '英尺/英寸', desc: '英制' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.height === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="height"
                        value={option.value}
                        checked={formData.height === option.value}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{option.label}</div>
                      <div className="text-xs text-text-secondary">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  温度单位
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'celsius', label: '摄氏度 (°C)', desc: '公制' },
                    { value: 'fahrenheit', label: '华氏度 (°F)', desc: '英制' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.temperature === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="temperature"
                        value={option.value}
                        checked={formData.temperature === option.value}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
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

          <div className="card bg-background-weak border-primary/20">
            <div className="flex items-start gap-3">
              <Ruler size={20} className="text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-text-primary mb-1">单位说明</h4>
                <p className="text-sm text-text-secondary">
                  单位设置将影响所有数据展示，包括配速、距离、体重、身高、温度等指标的显示方式。设置会自动同步到所有页面。
                </p>
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

export default UnitsSettings
