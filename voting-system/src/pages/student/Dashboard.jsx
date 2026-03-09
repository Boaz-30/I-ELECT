import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

function pad(value) {
  return String(value).padStart(2, '0')
}

function getResultsApproved(election) {
  if (!election) return false

  if (typeof election.results_approved === 'boolean') {
    return election.results_approved
  }

  if (typeof election.is_results_approved === 'boolean') {
    return election.is_results_approved
  }

  if (typeof election.resultsApproved === 'boolean') {
    return election.resultsApproved
  }

  if (typeof election.results_status === 'string') {
    return election.results_status.toLowerCase() === 'approved'
  }

  return false
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [election, setElection] = useState(null)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    let isMounted = true

    const fetchActiveElection = async () => {
      setLoading(true)
      setError('')

      const { data, error: queryError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('end_time', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!isMounted) return

      if (queryError) {
        setError('Failed to load election data.')
        setElection(null)
      } else {
        setElection(data ?? null)
      }

      setLoading(false)
    }

    fetchActiveElection()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const userName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Student'
  const studentId =
    user?.user_metadata?.student_id ?? user?.email?.split('@')[0] ?? '--'

  const electionTitle =
    election?.title ?? election?.name ?? 'Student Union Government Elections'

  const endAt = election?.end_time ? new Date(election.end_time) : null
  const endAtMs = endAt ? endAt.getTime() : null
  const hasEnded = Boolean(endAtMs && nowMs >= endAtMs)
  const resultsApproved = getResultsApproved(election)

  const countdown = useMemo(() => {
    if (!endAtMs) {
      return { days: '00', hours: '00', minutes: '00', seconds: '00' }
    }

    const remaining = Math.max(0, endAtMs - nowMs)
    const totalSeconds = Math.floor(remaining / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return {
      days: pad(days),
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    }
  }, [endAtMs, nowMs])

  const closingText = endAt
    ? `Closing on ${endAt.toLocaleDateString()} - ${endAt.toLocaleTimeString()}`
    : 'Closing time unavailable'

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loader} />
        <p style={styles.loadingText}>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.logoWrap}>
          <span style={styles.logoDot} />
          <span style={styles.logoText}>UniVote</span>
        </div>

        <div style={styles.profileWrap}>
          <div style={styles.profileTextWrap}>
            <p style={styles.profileName}>{userName}</p>
            <p style={styles.profileId}>Student ID: {studentId}</p>
          </div>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.heroCard}>
          <div style={styles.heroPattern}>
            <span style={styles.activePill}>ACTIVE</span>
          </div>
          <div style={styles.heroBody}>
            <h1 style={styles.heroTitle}>{electionTitle}</h1>
            <p style={styles.heroDesc}>
              Exercise your democratic right. Your vote decides representation
              for the next academic session.
            </p>

            {error ? <p style={styles.errorText}>{error}</p> : null}

            {!election ? (
              <p style={styles.stateText}>No Active Election</p>
            ) : null}

            {election && hasEnded && !resultsApproved ? (
              <p style={styles.stateText}>
                Voting Closed. Results Pending Approval
              </p>
            ) : null}

            <div style={styles.heroActionRow}>
              {election && !hasEnded ? (
                <button
                  style={styles.primaryButton}
                  onClick={() => navigate('/vote')}
                >
                  Proceed to Vote
                </button>
              ) : null}

              {election && hasEnded && resultsApproved ? (
                <button
                  style={styles.secondaryButton}
                  onClick={() => navigate('/results')}
                >
                  View Results
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section style={styles.midGrid}>
          <div style={styles.countdownCard}>
            <div style={styles.countdownHeader}>
              <p style={styles.countdownTitle}>Ends in:</p>
              <p style={styles.countdownClosing}>{closingText}</p>
            </div>
            <div style={styles.timeGrid}>
              <div style={styles.timeBox}>
                <p style={styles.timeValue}>{countdown.days}</p>
                <p style={styles.timeLabel}>DAYS</p>
              </div>
              <div style={styles.timeBox}>
                <p style={styles.timeValue}>{countdown.hours}</p>
                <p style={styles.timeLabel}>HOURS</p>
              </div>
              <div style={styles.timeBox}>
                <p style={styles.timeValue}>{countdown.minutes}</p>
                <p style={styles.timeLabel}>MINUTES</p>
              </div>
              <div style={styles.timeBox}>
                <p style={styles.timeValue}>{countdown.seconds}</p>
                <p style={styles.timeLabel}>SECONDS</p>
              </div>
            </div>
          </div>

          <div style={styles.requirementCard}>
            <h2 style={styles.requirementTitle}>Voting Requirements</h2>
            <ul style={styles.requirementList}>
              <li>Active student registration</li>
              <li>Verified biometric or digital identity</li>
              <li>One-time voting token issued on proceed</li>
            </ul>
          </div>
        </section>
      </main>

      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f2f4f8',
    color: '#09214d',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  loadingPage: {
    minHeight: '100vh',
    background: '#f2f4f8',
    display: 'grid',
    placeItems: 'center',
    gap: '0.5rem',
  },
  loader: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid #b7c4df',
    borderTopColor: '#0a2a62',
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: '#4e6286',
    fontWeight: 600,
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#ffffff',
    padding: '0.9rem 2rem',
    borderBottom: '1px solid #d8dfec',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  logoDot: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    background: '#0a2a62',
    boxShadow: '0 0 0 4px #e6edf9 inset',
  },
  logoText: {
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.04rem',
    color: '#0a2a62',
  },
  profileWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
  },
  profileTextWrap: {
    textAlign: 'right',
  },
  profileName: {
    margin: 0,
    fontWeight: 700,
    color: '#102856',
  },
  profileId: {
    margin: 0,
    color: '#5d7196',
  },
  logoutButton: {
    border: 0,
    borderRadius: '10px',
    padding: '0.7rem 1rem',
    background: '#072659',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  main: {
    padding: '1.6rem 2rem 2rem',
    display: 'grid',
    gap: '1.4rem',
  },
  heroCard: {
    background: '#ffffff',
    borderRadius: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    overflow: 'hidden',
    border: '1px solid #d9e1ef',
  },
  heroPattern: {
    background:
      'radial-gradient(circle at 1px 1px, #25467f 1px, transparent 0) 0 0 / 20px 20px, #072659',
    minHeight: '220px',
    display: 'grid',
    placeItems: 'center',
  },
  activePill: {
    background: '#18c58f',
    color: '#fff',
    fontWeight: 800,
    letterSpacing: '0.06rem',
    fontSize: '0.85rem',
    padding: '0.35rem 0.8rem',
    borderRadius: '999px',
  },
  heroBody: {
    padding: '2rem',
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3.2rem)',
    lineHeight: 1.05,
    color: '#071f4d',
  },
  heroDesc: {
    margin: '0.9rem 0 1rem',
    color: '#364f78',
    fontSize: 'clamp(1rem, 2.1vw, 1.5rem)',
    lineHeight: 1.45,
  },
  errorText: {
    margin: '0 0 0.8rem',
    color: '#b42318',
    fontWeight: 600,
  },
  stateText: {
    margin: '0 0 1rem',
    color: '#071f4d',
    fontWeight: 700,
  },
  heroActionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  primaryButton: {
    border: 0,
    borderRadius: '10px',
    padding: '0.95rem 1.3rem',
    background: '#072659',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #bac7dc',
    borderRadius: '10px',
    padding: '0.95rem 1.3rem',
    background: '#fff',
    color: '#102856',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  midGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
  },
  countdownCard: {
    background: '#fff',
    border: '1px solid #d9e1ef',
    borderRadius: '12px',
    padding: '1.35rem',
  },
  countdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  countdownTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#0d285c',
  },
  countdownClosing: {
    margin: 0,
    color: '#4e6286',
    fontWeight: 600,
  },
  timeGrid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
    gap: '0.75rem',
  },
  timeBox: {
    background: '#f6f8fc',
    border: '1px solid #d9e1ef',
    borderRadius: '10px',
    textAlign: 'center',
    padding: '0.8rem 0.4rem',
  },
  timeValue: {
    margin: 0,
    fontSize: '2.3rem',
    fontWeight: 900,
    color: '#072659',
  },
  timeLabel: {
    margin: '0.2rem 0 0',
    letterSpacing: '0.08rem',
    color: '#5b6e93',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  requirementCard: {
    background: '#072659',
    color: '#fff',
    borderRadius: '12px',
    padding: '1.35rem',
    border: '1px solid #0f3a81',
  },
  requirementTitle: {
    margin: 0,
    fontSize: '1.45rem',
  },
  requirementList: {
    margin: '0.8rem 0 0',
    paddingLeft: '1.15rem',
    display: 'grid',
    gap: '0.55rem',
  },
}
