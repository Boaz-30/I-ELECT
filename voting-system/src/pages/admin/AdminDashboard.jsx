import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

function isApproved(election) {
  if (!election) return false
  return (
    election.results_approved === true ||
    election.is_results_approved === true ||
    election.resultsApproved === true ||
    (typeof election.results_status === 'string' && election.results_status.toLowerCase() === 'approved')
  )
}

// BUG FIX #15 — return full {count, error} object so callers can inspect error
async function safeCount(table, filter = null) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  return { count: error ? null : (count ?? 0), error }
}

// BUG FIX #16 — surface error when all vote table guesses fail
async function getVoteCount() {
  for (const t of ['votes', 'ballots', 'election_votes']) {
    const { count, error } = await safeCount(t)
    if (!error && count !== null) return { count, error: null }
  }
  return { count: null, error: new Error('Could not find votes table') }
}

function StatCard({ icon, label, value, accent, note, loading }) {
  return (
    <div style={{ ...st.statCard, borderLeft: `4px solid ${accent}` }}>
      <div style={st.statTop}>
        <div style={{ ...st.statIcon, background: `${accent}18` }}>
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        </div>
        <span style={st.statLabel}>{label}</span>
      </div>
      {loading ? (
        <div style={st.statSkeleton} />
      ) : (
        <p style={{ ...st.statValue, color: accent }}>{value ?? '--'}</p>
      )}
      {note && <p style={st.statNote}>{note}</p>}
    </div>
  )
}

const navLinks = (role) => {
  const base = [
    { label: 'Elections', path: '/admin/elections', icon: '🗳️' },
    { label: 'Positions', path: '/admin/positions', icon: '📋' },
    { label: 'Candidates', path: '/admin/candidates', icon: '👤' },
    { label: 'Live Results', path: '/admin/live-results', icon: '📊' },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: '📝' },
  ]
  if (role === 'super_admin') base.push({ label: 'Manage Admins', path: '/admin/manage-admins', icon: '⚙️' })
  return base
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()   // BUG FIX #17 — use location to determine active nav item
  const { user, role, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalStudents: null, totalVotes: null,
    activeElection: null, resultsApproved: null,
    participationPct: null,
  })

  useEffect(() => {
    let mounted = true
    const fetchSummary = async () => {
      setLoading(true); setError('')

      // BUG FIX #15 — correct destructuring using updated safeCount
      const [studentsResult, votesResult] = await Promise.all([
        safeCount('profiles', (q) => q.eq('role', 'student')),
        getVoteCount(),
      ])

      const totalStudents = studentsResult.count
      const totalVotes = votesResult.count

      if (studentsResult.error) console.warn('Could not count students:', studentsResult.error.message)
      if (votesResult.error) console.warn('Could not count votes:', votesResult.error.message)

      const { data: activeElection } = await supabase
        .from('elections').select('*').eq('is_active', true)
        .order('start_time', { ascending: false }).limit(1).maybeSingle()

      let resultsSource = activeElection
      if (!resultsSource) {
        const { data: latest } = await supabase
          .from('elections').select('*').order('end_time', { ascending: false }).limit(1).maybeSingle()
        resultsSource = latest ?? null
      }

      if (!mounted) return
      const pct = (totalStudents && totalVotes)
        ? Math.round((totalVotes / totalStudents) * 100)
        : null

      setSummary({
        totalStudents,
        totalVotes,
        activeElection,
        resultsApproved: isApproved(resultsSource),
        participationPct: pct,
      })
      setLoading(false)
    }
    fetchSummary()
    return () => { mounted = false }
  }, [])

  const adminName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Admin'
  const links = useMemo(() => navLinks(role), [role])

  const handleLogout = async () => {
    try { await logout() } finally { navigate('/login') }
  }

  const activeStatus = summary.activeElection ? 'Live' : 'Inactive'

  return (
    <div style={st.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
        .nav-link:hover{background:rgba(26,86,219,0.08)!important;color:#1a56db!important}
        .nav-link.active{background:rgba(26,86,219,0.1)!important;color:#1a56db!important}
        .stat-card:hover{box-shadow:0 4px 24px rgba(0,0,0,0.08)!important;transform:translateY(-2px)}
        .quick-link:hover{border-color:#1a56db!important;background:#eff6ff!important}
      `}</style>

      {/* Sidebar */}
      <aside style={{ ...st.sidebar, ...(sidebarOpen ? {} : st.sidebarCollapsed) }}>
        <div style={st.sidebarTop}>
          <div style={st.brand}>
            <div style={st.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            {sidebarOpen && <span style={st.brandText}>UniVote</span>}
          </div>
          {sidebarOpen && <p style={st.brandRole}>{role === 'super_admin' ? 'Super Administrator' : 'Election Officer'}</p>}
        </div>

        <nav style={st.navList}>
          <button
            className={location.pathname === '/admin' ? 'nav-link active' : 'nav-link'}
            style={st.navLink}
            onClick={() => navigate('/admin')}
          >
            <span style={st.navIcon}>🏠</span>
            {sidebarOpen && <span style={st.navLabel}>Dashboard</span>}
          </button>
          {links.map(link => (
            <button
              key={link.path}
              className={location.pathname.startsWith(link.path) ? 'nav-link active' : 'nav-link'}
              style={st.navLink}
              onClick={() => navigate(link.path)}
            >
              <span style={st.navIcon}>{link.icon}</span>
              {sidebarOpen && <span style={st.navLabel}>{link.label}</span>}
            </button>
          ))}
        </nav>

        <div style={st.sidebarBottom}>
          {sidebarOpen && (
            <div style={st.adminProfile}>
              <div style={st.adminAvatar}>{adminName.charAt(0).toUpperCase()}</div>
              <div>
                <p style={st.adminName}>{adminName}</p>
                <p style={st.adminRole}>{role === 'super_admin' ? 'Super Admin' : 'Officer'}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={st.logoutBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={st.mainArea}>
        {/* Topbar */}
        <header style={st.topbar}>
          <div style={st.topbarLeft}>
            <button onClick={() => setSidebarOpen(v => !v)} style={st.menuBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <h1 style={st.topTitle}>Admin Dashboard</h1>
              <p style={st.topSub}>Welcome back, {adminName.split(' ')[0]}</p>
            </div>
          </div>
          <div style={st.topbarRight}>
            {summary.activeElection ? (
              <div style={st.liveIndicator}>
                <span style={st.liveDot} />
                <span>Election Live</span>
              </div>
            ) : (
              <div style={st.inactiveBadge}>No Active Election</div>
            )}
          </div>
        </header>

        <main style={st.content}>
          {error && <div style={st.errorAlert}>{error}</div>}

          {/* Stats grid */}
          <section style={st.statsGrid}>
            <div className="stat-card" style={{ ...st.statCard, borderLeft: '4px solid #1a56db', transition: 'box-shadow 0.15s, transform 0.15s' }}>
              <div style={st.statTop}>
                <div style={{ ...st.statIcon, background: '#eff6ff' }}>🎓</div>
                <span style={st.statLabel}>Total Students</span>
              </div>
              {loading ? <div style={st.statSkeleton} /> : (
                <p style={{ ...st.statValue, color: '#1a56db' }}>
                  {summary.totalStudents != null ? summary.totalStudents.toLocaleString() : '--'}
                </p>
              )}
              <p style={st.statNote}>Registered voters</p>
            </div>

            <div className="stat-card" style={{ ...st.statCard, borderLeft: '4px solid #059669', transition: 'box-shadow 0.15s, transform 0.15s' }}>
              <div style={st.statTop}>
                <div style={{ ...st.statIcon, background: '#f0fdf4' }}>🗳️</div>
                <span style={st.statLabel}>Votes Cast</span>
              </div>
              {loading ? <div style={st.statSkeleton} /> : (
                <p style={{ ...st.statValue, color: '#059669' }}>
                  {summary.totalVotes != null ? summary.totalVotes.toLocaleString() : '--'}
                </p>
              )}
              <p style={st.statNote}>Total ballots submitted</p>
            </div>

            <div className="stat-card" style={{ ...st.statCard, borderLeft: '4px solid #7c3aed', transition: 'box-shadow 0.15s, transform 0.15s' }}>
              <div style={st.statTop}>
                <div style={{ ...st.statIcon, background: '#f5f3ff' }}>📈</div>
                <span style={st.statLabel}>Participation</span>
              </div>
              {loading ? <div style={st.statSkeleton} /> : (
                <p style={{ ...st.statValue, color: '#7c3aed' }}>
                  {summary.participationPct != null ? `${summary.participationPct}%` : '--'}
                </p>
              )}
              <p style={st.statNote}>Of registered voters</p>
            </div>

            <div className="stat-card" style={{
              ...st.statCard,
              borderLeft: `4px solid ${summary.activeElection ? '#059669' : '#6b7280'}`,
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}>
              <div style={st.statTop}>
                <div style={{ ...st.statIcon, background: summary.activeElection ? '#f0fdf4' : '#f9fafb' }}>
                  {summary.activeElection ? '🟢' : '⚫'}
                </div>
                <span style={st.statLabel}>Election Status</span>
              </div>
              {loading ? <div style={st.statSkeleton} /> : (
                <p style={{ ...st.statValue, color: summary.activeElection ? '#059669' : '#6b7280', fontSize: '1.75rem' }}>
                  {activeStatus}
                </p>
              )}
              <p style={st.statNote}>
                {summary.resultsApproved ? '✓ Results approved' : 'Results pending approval'}
              </p>
            </div>
          </section>

          {/* Quick actions */}
          <section style={st.section}>
            <h2 style={st.sectionTitle}>Quick Actions</h2>
            <div style={st.quickGrid}>
              {[
                { icon: '🗳️', title: 'Manage Elections', desc: 'Create, start, end and manage elections', path: '/admin/elections' },
                { icon: '📋', title: 'Manage Positions', desc: 'Add or edit voting positions', path: '/admin/positions' },
                { icon: '👤', title: 'Manage Candidates', desc: 'Add candidates with photos and manifestos', path: '/admin/candidates' },
                { icon: '📊', title: 'Live Results', desc: 'Monitor votes in real-time', path: '/admin/live-results' },
                { icon: '📝', title: 'Audit Logs', desc: 'Review system and admin activity', path: '/admin/audit-logs' },
                ...(role === 'super_admin' ? [{ icon: '⚙️', title: 'Manage Admins', desc: 'Create and revoke admin access', path: '/admin/manage-admins' }] : []),
              ].map(item => (
                <button
                  key={item.path}
                  className="quick-link"
                  onClick={() => navigate(item.path)}
                  style={st.quickLink}
                >
                  <span style={st.quickIcon}>{item.icon}</span>
                  <div style={st.quickText}>
                    <span style={st.quickTitle}>{item.title}</span>
                    <span style={st.quickDesc}>{item.desc}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

const st = {
  page: {
    minHeight: '100vh', display: 'flex',
    fontFamily: "'Sora', sans-serif",
    background: '#f8fafc', color: '#0f172a',
  },
  sidebar: {
    width: '260px', minHeight: '100vh',
    background: '#0f172a', display: 'flex', flexDirection: 'column',
    position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
    transition: 'width 0.2s ease', flexShrink: 0,
  },
  sidebarCollapsed: { width: '68px' },
  sidebarTop: { padding: '1.5rem 1rem 1rem' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' },
  brandIcon: {
    width: '36px', height: '36px', flexShrink: 0,
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    borderRadius: '10px', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { fontSize: '1.2rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' },
  brandRole: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0 46px', whiteSpace: 'nowrap' },
  navList: { flex: 1, padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' },
  navLink: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    background: 'transparent', border: 'none', borderRadius: '10px',
    padding: '10px 12px', color: 'rgba(255,255,255,0.6)',
    fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', fontWeight: '600',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s, color 0.12s',
  },
  navIcon: { fontSize: '1rem', flexShrink: 0, width: '20px', textAlign: 'center' },
  navLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sidebarBottom: { padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' },
  adminProfile: {
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '10px', padding: '8px',
    background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
  },
  adminAvatar: {
    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '0.85rem',
  },
  adminName: { margin: 0, fontSize: '0.82rem', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' },
  adminRole: { margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  logoutBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
    borderRadius: '10px', color: '#f87171', padding: '8px',
    fontFamily: "'Sora', sans-serif", fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', transition: 'background 0.12s',
  },
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '0 2rem', height: '72px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 5,
  },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  menuBtn: {
    width: '36px', height: '36px', background: '#f3f4f6',
    border: 'none', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#374151', flexShrink: 0,
  },
  topTitle: { margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' },
  topSub: { margin: 0, fontSize: '0.78rem', color: '#6b7280', fontWeight: '500' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  liveIndicator: {
    display: 'flex', alignItems: 'center', gap: '7px',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '999px', padding: '6px 14px',
    color: '#15803d', fontSize: '0.8rem', fontWeight: '700',
  },
  liveDot: {
    width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a',
  },
  inactiveBadge: {
    background: '#f3f4f6', border: '1px solid #e5e7eb',
    borderRadius: '999px', padding: '6px 14px',
    color: '#6b7280', fontSize: '0.8rem', fontWeight: '600',
  },
  content: {
    flex: 1, padding: '2rem',
    display: 'flex', flexDirection: 'column', gap: '2rem',
  },
  errorAlert: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    background: '#fff', borderRadius: '16px',
    padding: '1.5rem', border: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  statTop: { display: 'flex', alignItems: 'center', gap: '10px' },
  statIcon: {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', flexShrink: 0,
  },
  statLabel: { color: '#6b7280', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue: {
    margin: 0, fontSize: '2.25rem', fontWeight: '900',
    letterSpacing: '-0.04em', lineHeight: 1,
  },
  statSkeleton: {
    height: '2.5rem', width: '60%',
    background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
    backgroundSize: '200% 100%',
    borderRadius: '8px',
    animation: 'shimmer 1.5s infinite',
  },
  statNote: { margin: 0, color: '#9ca3af', fontSize: '0.75rem', fontWeight: '500' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: {
    margin: 0, fontSize: '1rem', fontWeight: '800',
    color: '#0f172a', letterSpacing: '-0.01em',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '10px',
  },
  quickLink: {
    display: 'flex', alignItems: 'center', gap: '14px',
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '14px', padding: '14px 16px',
    cursor: 'pointer', textAlign: 'left',
    fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s, background 0.15s',
  },
  quickIcon: { fontSize: '1.25rem', flexShrink: 0 },
  quickText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  quickTitle: { fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' },
  quickDesc: { fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' },
}