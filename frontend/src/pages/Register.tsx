import { useState } from 'react'
import { Activity } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/today" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(email, password, name)
      navigate('/today', { replace: true })
    } catch (reason: any) {
      setError(reason.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background-page px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="w-12 h-12 bg-primary text-white rounded-lg flex items-center justify-center mb-5">
            <Activity size={26} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">创建 AthleteOS 账户</h1>
          <p className="mt-2 text-text-secondary">每位用户的数据源、训练记录和建议完全隔离</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-text-primary">称呼</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-primary">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-primary">密码</span>
            <input
              type="password"
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-border bg-white px-4 py-3 outline-none focus:border-primary"
            />
            <span className="mt-1 block text-xs text-text-secondary">至少 10 位，同时包含字母和数字</span>
          </label>
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? '创建中...' : '创建账户'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          已有账户？ <Link className="text-primary font-medium" to="/login">返回登录</Link>
        </p>
      </div>
    </main>
  )
}
