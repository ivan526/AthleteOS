import { useState } from 'react'
import { ArrowLeft, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'

const ProfileSettings = () => {
  const [formData, setFormData] = useState({
    name: '测试用户',
    email: 'test@example.com',
    birthDate: '1990-01-01',
    gender: 'male',
    weight: 70,
    height: 175,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 提交保存
    alert('个人资料已保存')
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
          <h1 className="text-2xl font-bold text-text-primary mb-1">个人资料</h1>
          <p className="text-text-secondary">管理你的个人基本信息</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card">
            <div className="space-y-4">
              {/* 头像 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={40} className="text-primary" />
                </div>
                <button type="button" className="btn-secondary h-auto py-2 px-4 text-sm">
                  更换头像
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  昵称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  出生日期
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  性别
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'other', label: '保密' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`p-3 border rounded-xl text-center cursor-pointer transition-all ${
                        formData.gender === option.value
                          ? 'border-primary bg-background-weak'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={formData.gender === option.value}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="sr-only"
                      />
                      <span className="font-medium text-text-primary">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    体重 (kg)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    身高 (cm)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            保存更改
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default ProfileSettings
