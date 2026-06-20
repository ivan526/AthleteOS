import { useState } from 'react'
import { Activity, Eye, EyeOff } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/today" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      const target = (location.state as { from?: string } | null)?.from ?? '/today'
      navigate(target, { replace: true })
    } catch (reason: any) {
      setError(reason.message || '登录失败')
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
          <h1 className="text-3xl font-bold text-text-primary">登录 AthleteOS</h1>
          <p className="mt-2 text-text-secondary">继续查看你的训练建议与恢复状态</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
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
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-white px-4 py-3 pr-12 outline-none focus:border-primary"
              />
              <button
                type="button"
                title={showPassword ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          还没有账户？ <Link className="text-primary font-medium" to="/register">创建账户</Link>
        </p>
      </div>
    </main>
  )
}
