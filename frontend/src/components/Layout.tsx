import { type ReactNode } from 'react'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
  showNav?: boolean
}

const Layout = ({ children, showNav = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background-page pb-20">
      {children}
      {showNav && <BottomNav />}
    </div>
  )
}

export default Layout
