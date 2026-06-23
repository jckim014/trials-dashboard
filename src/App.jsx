import React from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AdminProvider, useAdmin } from './context/AdminContext.jsx'
import CalendarPage from './components/calendar/CalendarPage.jsx'
import StatsPage from './components/stats/StatsPage.jsx'
import AdminPage from './components/admin/AdminPage.jsx'
import AdminLogin from './components/admin/AdminLogin.jsx'

function NavBar() {
  const { isAdmin, logout } = useAdmin()
  const location = useLocation()
  const navigate = useNavigate()

  const links = [
    { path: '/', label: 'Calendar' },
    { path: '/stats', label: 'Stats' },
    { path: '/admin', label: 'Admin' },
  ]

  return (
    <nav className="main-nav">
      <span className="nav-brand">ARC // TRIALS</span>
      <div className="nav-links">
        {links.map((l) => (
          <button
            key={l.path}
            className={'nav-link' + (location.pathname === l.path ? ' active' : '')}
            onClick={() => navigate(l.path)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="nav-right">
        {isAdmin && (
          <>
            <span className="nav-admin-badge">ADMIN</span>
            <button onClick={logout} style={{ fontSize: 12 }}>Log out</button>
          </>
        )}
      </div>
    </nav>
  )
}

function AdminRoute() {
  const { isAdmin, loading } = useAdmin()
  if (loading) return <div className="container"><p>Loading...</p></div>
  return isAdmin ? <AdminPage /> : <AdminLogin />
}

export default function App() {
  return (
    <AdminProvider>
      <HashRouter>
        <NavBar />
        <div className="container">
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/admin" element={<AdminRoute />} />
          </Routes>
        </div>
      </HashRouter>
    </AdminProvider>
  )
}
