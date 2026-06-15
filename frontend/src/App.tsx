import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Today from './pages/Today'
import History from './pages/History'
import WeeklyReview from './pages/WeeklyReview'
import Settings from './pages/Settings'
import ConnectIntervals from './pages/ConnectIntervals'
import DebugState from './pages/DebugState'
import Goals from './pages/Goals'

function App() {
  return (
    <Router>
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
        </Routes>
      </div>
    </Router>
  )
}

export default App
