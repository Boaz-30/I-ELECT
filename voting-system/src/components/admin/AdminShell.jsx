import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { label: 'Dashboard',          path: '/admin',                icon: '🏠', exact: true  },
  { label: 'Elections',          path: '/admin/elections',      icon: '🗳️', exact: false },
  { label: 'Positions',          path: '/admin/positions',      icon: '📋', exact: false },
  { label: 'Candidates',         path: '/admin/candidates',     icon: '👤', exact: false },
  { label: 'Live Results',       path: '/admin/live-results',   icon: '📊', exact: false },
  { label: 'Audit Logs',         path: '/admin/audit-logs',     icon: '📝', exact: false },
]

const SUPER_NAV_ITEMS = [
  { label: 'Manage Admins',      path: '/admin/manage-admins',  icon: '⚙️', exact: false },
  { label: 'Create Admin',       path: '/admin/create-admin',   icon: '➕', exact: false },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.path
  return pathname.startsWith(item.path)
}

export default function AdminShell({ children, title, subtitle }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, role, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const adminName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? 'Admin'

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS]
    if (role === 'super_admin') items.push(...SUPER_NAV_ITEMS)
    return items
  }, [role])

  const handleLogout = async () => {
    try { await logout() } finally { navigate('/login') }
  }

  return (
    <div style={s.shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .ash-nav-item:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .ash-nav-item.active { background: rgba(26,86,219,0.25) !important; color: #93c5fd !important; }
        .ash-logout:hover { background: rgba(239,68,68,0.2) !important; }
        .ash-collapse:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{ ...s.sidebar, width: collapsed ? '64px' : '240px' }}>
        {/* Brand */}
        <div style={s.brand}>
          <div style={s.brandIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#fff"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && <span style={s.brandText}>UniVote</span>}
          <button
            className="ash-collapse"
            onClick={() => setCollapsed(v => !v)}
            style={s.collapseBtn}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {collapsed
                ? <polyline points="9 18 15 12 9 6"/>
                : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div style={s.roleBadge}>
            {role === 'super_admin' ? 'Super Administrator' : 'Election Officer'}
          </div>
        )}

        {/* Nav */}
        <nav style={s.nav}>
          {navItems.map(item => {
            const active = isActive(location.pathname, item)
            return (
              <button
                key={item.path}
                className={`ash-nav-item${active ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
                style={{ ...s.navItem, justifyContent: collapsed ? 'center' : 'flex-start' }}
                title={collapsed ? item.label : undefined}
              >
                <span style={s.navIcon}>{item.icon}</span>
                {!collapsed && <span style={s.navLabel}>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={s.sidebarBottom}>
          {!collapsed && (
            <div style={s.adminInfo}>
              <div style={s.adminAvatar}>{adminName.charAt(0).toUpperCase()}</div>
              <div style={s.adminText}>
                <p style={s.adminName}>{adminName}</p>
                <p style={s.adminRole}>{role === 'super_admin' ? 'Super Admin' : 'Officer'}</p>
              </div>
            </div>
          )}
          <button
            className="ash-logout"
            onClick={handleLogout}
            style={{ ...s.logoutBtn, justifyContent: collapsed ? 'center' : 'flex-start' }}
            title="Logout"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div style={s.main}>
        {/* Top bar */}
        <header style={s.topbar}>
          <div>
            {title    && <h1 style={s.topTitle}>{title}</h1>}
            {subtitle && <p  style={s.topSub}>{subtitle}</p>}
          </div>
          <div style={s.topRight}>
            {/* Live election dot */}
            <div style={s.sessionTag}>
              <span style={s.sessionDot} />
              <span style={s.sessionText}>Admin Session</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

const s = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'Sora', sans-serif",
    background: '#f8fafc',
    color: '#0f172a',
  },
  sidebar: {
    background: '#0f172a',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '1.1rem 1rem 0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  brandIcon: {
    width: '32px', height: '32px', flexShrink: 0,
    background: 'linear-gradient(135deg,#1a56db,#6366f1)',
    borderRadius: '9px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandText: {
    fontSize: '1.15rem', fontWeight: '800',
    color: '#fff', letterSpacing: '-0.02em',
    flex: 1, overflow: 'hidden',
  },
  collapseBtn: {
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
    padding: '4px', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  roleBadge: {
    margin: '0.5rem 1rem',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.65rem', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.09em',
    overflow: 'hidden', whiteSpace: 'nowrap',
  },
  nav: {
    flex: 1,
    padding: '0.4rem 0.5rem',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  navItem: {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'transparent', border: 'none',
    borderRadius: '9px', padding: '9px 10px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: "'Sora', sans-serif",
    fontSize: '0.86rem', fontWeight: '600',
    cursor: 'pointer', textAlign: 'left',
    transition: 'background 0.12s, color 0.12s',
    whiteSpace: 'nowrap', overflow: 'hidden',
  },
  navIcon: { fontSize: '0.95rem', flexShrink: 0, width: '20px', textAlign: 'center' },
  navLabel: { overflow: 'hidden', textOverflow: 'ellipsis' },
  sidebarBottom: {
    padding: '0.75rem 0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  adminInfo: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 8px',
    background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
    overflow: 'hidden',
  },
  adminAvatar: {
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#1a56db,#6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '0.82rem',
  },
  adminText: { overflow: 'hidden' },
  adminName: {
    margin: 0, fontSize: '0.8rem', fontWeight: '700',
    color: '#fff', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  adminRole: {
    margin: 0, fontSize: '0.68rem',
    color: 'rgba(255,255,255,0.35)', fontWeight: '500',
  },
  logoutBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '9px', color: '#f87171',
    fontFamily: "'Sora', sans-serif",
    fontSize: '0.82rem', fontWeight: '600',
    padding: '8px 10px', cursor: 'pointer',
    transition: 'background 0.12s',
  },
  main: {
    flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
  },
  topbar: {
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '0.85rem 1.5rem',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '1rem',
    flexWrap: 'wrap',
    position: 'sticky', top: 0, zIndex: 5,
  },
  topTitle: {
    margin: 0, fontSize: '1.15rem',
    fontWeight: '800', color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  topSub: {
    margin: '2px 0 0', fontSize: '0.78rem',
    color: '#6b7280', fontWeight: '500',
  },
  topRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  sessionTag: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '999px', padding: '5px 12px',
  },
  sessionDot: {
    width: '6px', height: '6px',
    borderRadius: '50%', background: '#16a34a',
  },
  sessionText: {
    color: '#15803d', fontSize: '0.75rem', fontWeight: '700',
  },
  content: {
    flex: 1, padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
}