import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import LoginPage from './pages/LoginPage'
import BoardPage from './pages/BoardPage'
import PublicSubmitPage from './pages/PublicSubmitPage'
import ReportPage from './pages/ReportPage'
import DashboardPage from './pages/DashboardPage'
import HelpPage from './pages/HelpPage'
import { getStoredUser, logout, type User } from './auth'

function Shell({ user, onLogout, children }: { user: User; onLogout: () => void; children: any }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold text-gray-900">AdminOps Lite</Link>
          <div className="flex items-center gap-3">
            <Link
              to="/board"
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            >
              Admin Inbox
            </Link>
            <Link
              to="/reports"
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            >
              Reports
            </Link>
            <Link
              to="/help"
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            >
              How it works
            </Link>
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const isAuthed = useMemo(() => !!user, [user])

  const handleLogout = () => {
    logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <Routes>
      <Route path="/submit/:clientCode" element={<PublicSubmitPage />} />
      <Route
        path="/login"
        element={<LoginPage onLoggedIn={(u: User) => { setUser(u); navigate('/') }} />}
      />
      <Route
        path="/reports"
        element={
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <ReportPage />
            </Shell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/help"
        element={
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <HelpPage />
            </Shell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/board"
        element={
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <BoardPage />
            </Shell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <DashboardPage />
            </Shell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
