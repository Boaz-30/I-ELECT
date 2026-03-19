import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// ── Student auth ─────────────────────────────────────────────────────────────
import StudentLogin  from '../pages/auth/StudentLogin'
import StudentSignup from '../pages/auth/StudentSignup'

// ── Admin auth ───────────────────────────────────────────────────────────────
import AdminLogin    from '../pages/auth/AdminLogin'
import AdminSignup   from '../pages/admin/AdminSignup'

// ── Student pages ─────────────────────────────────────────────────────────────
import Dashboard     from '../pages/student/Dashboard'
import Vote          from '../pages/student/Vote'
import Results       from '../pages/student/Results'

// ── Admin pages ───────────────────────────────────────────────────────────────
import AdminDashboard from '../pages/admin/AdminDashboard'
import Elections      from '../pages/admin/Elections'
import Positions      from '../pages/admin/Positions'
import Candidates     from '../pages/admin/Candidates'
import LiveResults    from '../pages/admin/LiveResults'
import AuditLogs      from '../pages/admin/AuditLogs'
import ManageAdmins   from '../pages/admin/ManageAdmins'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root → student login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Student auth */}
        <Route path="/login"  element={<StudentLogin  />} />
        <Route path="/signup" element={<StudentSignup />} />

        {/* Admin auth — completely separate portal */}
        <Route path="/admin/login"  element={<AdminLogin  />} />
        <Route path="/admin/signup" element={<AdminSignup />} />

        {/* Student portal */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vote"      element={<Vote      />} />
        <Route path="/results"   element={<Results   />} />

        {/* Admin portal */}
        <Route path="/admin"               element={<AdminDashboard />} />
        <Route path="/admin/elections"     element={<Elections      />} />
        <Route path="/admin/positions"     element={<Positions      />} />
        <Route path="/admin/candidates"    element={<Candidates     />} />
        <Route path="/admin/live-results"  element={<LiveResults    />} />
        <Route path="/admin/audit-logs"    element={<AuditLogs      />} />
        <Route path="/admin/manage-admins" element={<ManageAdmins   />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}