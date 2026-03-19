import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

export default function AdminShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, logout } = useAuth()

  const adminName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Admin'

  const navItems = useMemo(() => {
    const base = [
      { label: 'Dashboard', path: '/admin' },
      { label: 'Elections', path: '/admin/elections' },
      { label: 'Positions', path: '/admin/positions' },
      { label: 'Candidates', path: '/admin/candidates' },
      { label: 'Live Results', path: '/admin/live-results' },
      { label: 'Audit Logs', path: '/admin/audit-logs' },
    ]

    if (role === 'super_admin') {
      base.push({ label: 'Manage Admins', path: '/admin/manage-admins' })
    }

    return base
  }, [role])

  const logoutHandler = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  const activePath = location.pathname

  return (
    <div className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col justify-between gap-6 p-4 lg:p-5">
            <div className="grid gap-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <span className="text-sm font-extrabold tracking-wide">UV</span>
                </div>
                <div>
                  <p className="text-lg font-black tracking-tight">UniVote</p>
                  <p className="text-xs font-bold tracking-[0.16em] text-slate-500">
                    ADMINISTRATOR
                  </p>
                </div>
              </div>

              <nav className="grid gap-1">
                {navItems.map((item) => {
                  const isActive =
                    item.path === '/admin'
                      ? activePath === '/admin' || activePath === '/admin/dashboard'
                      : activePath.startsWith(item.path)

                  return (
                    <button
                      key={item.label}
                      className={cx(
                        'inline-flex h-10 items-center rounded-xl px-3 text-left text-sm font-semibold transition',
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      )}
                      onClick={() => navigate(item.path)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              onClick={logoutHandler}
              type="button"
            >
              Logout
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight text-slate-900">
                  {title}
                </p>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-sm text-slate-600">{subtitle}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  {role === 'super_admin' ? 'Super Admin' : 'Admin'} · {adminName}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
            </div>
          </header>

          <main className="w-full px-4 py-8 md:px-6">{children}</main>
        </section>
      </div>
    </div>
  )
}

