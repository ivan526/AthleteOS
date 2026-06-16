import { useState } from 'react'
import { ArrowLeft, Flag, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'

const GoalsSettings = () => {
  const [formData, setFormData] = useState({
    goalType: 'half_marathon',
    goalTime: '01:40:00',
    goalDate: '2026-11-15',
    currentLevel: 'intermediate',
    goalPriority: 'balanced',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 提交保存
    alert('目标设置已保存')
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
          <h1 className="text-2xl font-bold text-text-primary mb-1">目标设置</h1>
          <p className="text-text-secondary">设置你的运动目标，系统将为你定制训练计划</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  目标赛事
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: '5k', label: '5公里', desc: '入门级' },
                    { value: '10k', label: '10公里', desc: '进阶级' },
                    { value: 'half_marathon', label: '半程马拉松', desc: '挑战级' },
                    { value: 'marathon', label: '全程马拉松', desc: '精英级' },
                  ].map((goal) => (
                    <label
                      key={goal.value}
                      className={`p-4 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.goalType === goal.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="goalType"
                        value={goal.value}
                        checked={formData.goalType === goal.value}
                        onChange={(e) => setFormData({ ...formData, goalType: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{goal.label}</div>
                      <div className="text-xs text-text-secondary">{goal.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  目标时间
                </label>
                <input
                  type="time"
                  step="1"
                  value={formData.goalTime}
                  onChange={(e) => setFormData({ ...formData, goalTime: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  目标日期
                </label>
                <div className="relative">
                  <Calendar size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="date"
                    value={formData.goalDate}
                    onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  当前水平
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'beginner', label: '入门', desc: '少于3个月' },
                    { value: 'intermediate', label: '中级', desc: '3-12个月' },
                    { value: 'advanced', label: '高级', desc: '1年以上' },
                  ].map((level) => (
                    <label
                      key={level.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.currentLevel === level.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="currentLevel"
                        value={level.value}
                        checked={formData.currentLevel === level.value}
                        onChange={(e) => setFormData({ ...formData, currentLevel: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{level.label}</div>
                      <div className="text-xs text-text-secondary">{level.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  目标优先级
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'conservative', label: '保守', desc: '避免受伤' },
                    { value: 'balanced', label: '平衡', desc: '效果和安全平衡' },
                    { value: 'aggressive', label: '激进', desc: '追求成绩' },
                  ].map((priority) => (
                    <label
                      key={priority.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.goalPriority === priority.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="goalPriority"
                        value={priority.value}
                        checked={formData.goalPriority === priority.value}
                        onChange={(e) => setFormData({ ...formData, goalPriority: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium text-text-primary mb-1">{priority.label}</div>
                      <div className="text-xs text-text-secondary">{priority.desc}</div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-background-weak border-primary/20">
            <div className="flex items-start gap-3">
              <Flag size={20} className="text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-text-primary mb-1">目标分析</h4>
                <p className="text-sm text-text-secondary">
                  根据你的目标和当前水平，系统预计需要约24周的系统训练来达成半马140的目标。后续将为你生成渐进式训练计划。
                </p>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            保存目标
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default GoalsSettings
