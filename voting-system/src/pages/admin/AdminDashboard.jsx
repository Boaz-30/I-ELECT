import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

function isApproved(election) {
  if (!election) return false
  if (typeof election.results_approved === 'boolean') return election.results_approved
  if (typeof election.is_results_approved === 'boolean') return election.is_results_approved
  if (typeof election.resultsApproved === 'boolean') return election.resultsApproved
  if (typeof election.results_status === 'string') {
    return election.results_status.toLowerCase() === 'approved'
  }
  return false
}

async function getCount(table, filter = null) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) {
    query = filter(query)
  }

  const { count, error } = await query
  if (error) return { count: null, error }
  return { count: count ?? 0, error: null }
}

async function getVoteCount() {
  const candidates = ['votes', 'ballots', 'election_votes']
  for (const table of candidates) {
    const result = await getCount(table)
    if (!result.error) return result.count
  }
  return null
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 980 : false
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalStudents: null,
    totalVotes: null,
    activeElection: null,
    resultsApproved: null,
  })

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchSummary = async () => {
      setLoading(true)
      setError('')

      const [{ count: totalStudents, error: studentError }, totalVotes] =
        await Promise.all([
          getCount('profiles', (q) => q.eq('role', 'student')),
          getVoteCount(),
        ])

      const { data: activeElection, error: activeElectionError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      let resultsSource = activeElection
      if (!resultsSource) {
        const { data: latestElection } = await supabase
          .from('elections')
          .select('*')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()
        resultsSource = latestElection ?? null
      }

      if (!isMounted) return

      if (studentError || activeElectionError) {
        setError('Some dashboard metrics could not be loaded.')
      }

      setSummary({
        totalStudents,
        totalVotes,
        activeElection,
        resultsApproved: isApproved(resultsSource),
      })
      setLoading(false)
    }

    fetchSummary()

    return () => {
      isMounted = false
    }
  }, [])

  const adminName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Admin'

  const navItems = useMemo(() => {
    const base = [
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

  const activeStatus = summary.activeElection ? 'Live' : 'Inactive'
  const resultsStatus = summary.resultsApproved ? 'Approved' : 'Pending'

  const logoutHandler = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <aside style={{ ...styles.sidebar, ...(isMobile ? styles.sidebarMobile : {}) }}>
        <div>
          <div style={styles.logoWrap}>
            <div style={styles.logoBox}>UV</div>
            <div>
              <p style={styles.logoTitle}>UniVote</p>
              <p style={styles.logoSub}>ADMINISTRATOR</p>
            </div>
          </div>

          <button style={styles.dashboardBtn}>Dashboard</button>

          <nav style={styles.navList}>
            {navItems.map((item) => (
              <button
                key={item.label}
                style={styles.navItem}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <button style={styles.logoutBtn} onClick={logoutHandler}>
          Logout
        </button>
      </aside>

      <section style={{ ...styles.content, ...(isMobile ? styles.contentMobile : {}) }}>
        <header style={{ ...styles.topbar, ...(isMobile ? styles.topbarMobile : {}) }}>
          <input
            style={{ ...styles.search, ...(isMobile ? styles.searchMobile : {}) }}
            placeholder="Search logs, elections..."
            readOnly
          />
          <div style={styles.userBlock}>
            <div style={styles.userText}>
              <p style={styles.userName}>{role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
              <p style={styles.userSub}>{adminName}</p>
            </div>
            <div style={styles.userAvatar}>A</div>
          </div>
        </header>

        <main style={{ ...styles.main, ...(isMobile ? styles.mainMobile : {}) }}>
          <h1 style={styles.title}>Admin Dashboard Overview</h1>
          <p style={styles.subtitle}>
            Welcome back. System status is stable and elections are currently monitored.
          </p>
          {error ? <p style={styles.error}>{error}</p> : null}

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading summary...</p>
            </div>
          ) : (
            <section style={styles.cardGrid}>
              <article style={styles.card}>
                <p style={styles.cardLabel}>Total Students</p>
                <p style={styles.cardValue}>
                  {summary.totalStudents == null
                    ? '--'
                    : summary.totalStudents.toLocaleString()}
                </p>
              </article>

              <article style={styles.card}>
                <p style={styles.cardLabel}>Total Votes</p>
                <p style={styles.cardValue}>
                  {summary.totalVotes == null ? '--' : summary.totalVotes.toLocaleString()}
                </p>
              </article>

              <article style={styles.card}>
                <p style={styles.cardLabel}>Active Election</p>
                <p
                  style={{
                    ...styles.cardStatus,
                    color: activeStatus === 'Live' ? '#0f9f56' : '#8c9ab4',
                  }}
                >
                  {activeStatus}
                </p>
              </article>

              <article style={styles.card}>
                <p style={styles.cardLabel}>Results Approved</p>
                <p
                  style={{
                    ...styles.cardStatus,
                    color: resultsStatus === 'Approved' ? '#0f9f56' : '#c77800',
                  }}
                >
                  {resultsStatus}
                </p>
              </article>
            </section>
          )}
        </main>
      </section>

      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#eef2f7',
    color: '#0b234e',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
  },
  pageMobile: {
    gridTemplateColumns: '1fr',
  },
  sidebar: {
    background: '#f8fafe',
    borderRight: '1px solid #d9e2ef',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  sidebarMobile: {
    borderRight: 0,
    borderBottom: '1px solid #d9e2ef',
    gap: '1rem',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.1rem',
  },
  logoBox: {
    width: '44px',
    height: '44px',
    borderRadius: '6px',
    background: '#08255d',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    letterSpacing: '0.04rem',
  },
  logoTitle: {
    margin: 0,
    fontSize: '1.9rem',
    fontWeight: 800,
    color: '#08255d',
    letterSpacing: '-0.02rem',
  },
  logoSub: {
    margin: 0,
    fontSize: '0.8rem',
    letterSpacing: '0.07rem',
    color: '#5f769b',
    fontWeight: 700,
  },
  dashboardBtn: {
    width: '100%',
    height: '46px',
    border: 0,
    borderRadius: '8px',
    background: '#08255d',
    color: '#fff',
    fontWeight: 700,
    textAlign: 'left',
    padding: '0 0.9rem',
    marginBottom: '0.8rem',
  },
  navList: {
    display: 'grid',
    gap: '0.35rem',
  },
  navItem: {
    height: '42px',
    border: '1px solid transparent',
    background: 'transparent',
    color: '#2e4670',
    borderRadius: '8px',
    textAlign: 'left',
    padding: '0 0.7rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  logoutBtn: {
    height: '42px',
    border: '1px solid #f3b3b3',
    background: '#fff1f1',
    color: '#bf2121',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  content: {
    display: 'grid',
    gridTemplateRows: '68px 1fr',
  },
  contentMobile: {
    gridTemplateRows: 'auto 1fr',
  },
  topbar: {
    background: '#f8fafe',
    borderBottom: '1px solid #d9e2ef',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '0 1.25rem',
  },
  topbarMobile: {
    padding: '0.7rem 1rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  search: {
    width: 'min(420px, 100%)',
    height: '38px',
    border: '1px solid #d8e1ef',
    borderRadius: '8px',
    background: '#edf2f9',
    color: '#6f82a2',
    padding: '0 0.75rem',
  },
  searchMobile: {
    width: '100%',
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  userText: {
    textAlign: 'right',
  },
  userName: {
    margin: 0,
    fontWeight: 800,
  },
  userSub: {
    margin: 0,
    color: '#5f769b',
  },
  userAvatar: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#6b8e9e',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
  },
  main: {
    padding: '1.35rem',
  },
  mainMobile: {
    padding: '1rem',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.5rem, 3.2vw, 3rem)',
    lineHeight: 1.12,
    fontWeight: 900,
    letterSpacing: '-0.03rem',
    color: '#08255d',
  },
  subtitle: {
    margin: '0.4rem 0 0',
    color: '#5b6f93',
    fontSize: '1.35rem',
    lineHeight: 1.4,
  },
  error: {
    margin: '0.5rem 0 0',
    color: '#b42318',
    fontWeight: 600,
  },
  loadingWrap: {
    marginTop: '1rem',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '0.45rem',
    minHeight: '180px',
    background: '#f8fafe',
    border: '1px solid #d9e2ef',
    borderRadius: '12px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #cad6e8',
    borderTopColor: '#08255d',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: '#5f769b',
    fontWeight: 700,
  },
  cardGrid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '0.85rem',
  },
  card: {
    background: '#f8fafe',
    border: '1px solid #d9e2ef',
    borderRadius: '12px',
    padding: '1rem',
    minHeight: '138px',
    display: 'grid',
    alignContent: 'space-between',
  },
  cardLabel: {
    margin: 0,
    color: '#5c7197',
    fontWeight: 600,
  },
  cardValue: {
    margin: 0,
    fontSize: '3.3rem',
    fontWeight: 900,
    letterSpacing: '-0.03rem',
    color: '#091f4b',
  },
  cardStatus: {
    margin: 0,
    fontSize: '3.3rem',
    fontWeight: 900,
    letterSpacing: '-0.03rem',
  },
}
