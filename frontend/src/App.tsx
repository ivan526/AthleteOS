import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Today from './pages/Today'
import History from './pages/History'
import WeeklyReview from './pages/WeeklyReview'
import Settings from './pages/Settings'
import ConnectIntervals from './pages/ConnectIntervals'
import DebugState from './pages/DebugState'
import Goals from './pages/Goals'
import WorkoutDetail from './pages/WorkoutDetail'
import DecisionDetail from './pages/DecisionDetail'
import ModelBuilding from './pages/onboarding/ModelBuilding'
import ProfileSettings from './pages/settings/Profile'
import PreferencesSettings from './pages/settings/Preferences'
import GoalsSettings from './pages/settings/Goals'
import SafetySettings from './pages/settings/Safety'
import UnitsSettings from './pages/settings/Units'
import AboutPage from './pages/settings/About'
import ActivityDetail from './pages/ActivityDetail'
import FeedbackHistory from './pages/FeedbackHistory'
import { syncDaily } from './lib/api'
import Login from './pages/Login'
import Register from './pages/Register'
import { useAuth } from './auth/AuthContext'

function ProtectedApplication() {
  const { user, loading } = useAuth()
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    if (!user) {
      setBootstrapping(false)
      return
    }
    setBootstrapping(true)
    syncDaily()
      .catch((error) => {
        console.warn('每日自动同步失败，将使用最近一次数据', error)
      })
      .finally(() => setBootstrapping(false))
  }, [user])

  if (loading || (user && bootstrapping)) {
    return (
      <div className="min-h-screen bg-background-page flex items-center justify-center text-primary">
        正在更新今日数据...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-background-page">
      <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/connect/intervals" element={<ConnectIntervals />} />
          <Route path="/history" element={<History />} />
          <Route path="/weekly-review" element={<WeeklyReview />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/debug/state" element={<DebugState />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/decision" element={<DecisionDetail />} />
          <Route path="/onboarding/model-building" element={<ModelBuilding />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
          <Route path="/settings/preferences" element={<PreferencesSettings />} />
          <Route path="/settings/goals" element={<GoalsSettings />} />
          <Route path="/settings/safety" element={<SafetySettings />} />
          <Route path="/settings/units" element={<UnitsSettings />} />
          <Route path="/settings/about" element={<AboutPage />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/feedback" element={<FeedbackHistory />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={<ProtectedApplication />} />
      </Routes>
    </Router>
  )
}

export default App
