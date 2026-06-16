import { Link, useLocation } from 'react-router-dom'
import { Calendar, Clock, BarChart3, Settings } from 'lucide-react'

const BottomNav = () => {
  const location = useLocation()

  const navItems = [
    { path: '/today', label: '今日', icon: Clock },
    { path: '/history', label: '历史', icon: Calendar },
    { path: '/weekly-review', label: '复盘', icon: BarChart3 },
    { path: '/settings', label: '设置', icon: Settings },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-border/60 px-2 py-3 z-50">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNav
