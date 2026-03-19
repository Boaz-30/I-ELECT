import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import Dashboard from '../pages/student/Dashboard'
import Vote from '../pages/student/Vote'
import Results from '../pages/student/Results'
import LandingPage from '../pages/LandingPage'
import AdminDashboard from '../pages/admin/AdminDashboard'
import Elections from '../pages/admin/Elections'
import Positions from '../pages/admin/Positions'
import Candidates from '../pages/admin/Candidates'
import LiveResults from '../pages/admin/LiveResults'
import AuditLogs from '../pages/admin/AuditLogs'
import ManageAdmins from '../pages/admin/ManageAdmins'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student-login" element={<Login />} />
        <Route path="/admin-login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vote" element={<Vote />} />
        <Route path="/results" element={<Results />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/elections" element={<Elections />} />
        <Route path="/admin/positions" element={<Positions />} />
        <Route path="/admin/candidates" element={<Candidates />} />
        <Route path="/admin/live-results" element={<LiveResults />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/admin/manage-admins" element={<ManageAdmins />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
