import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

function pad(v) { return String(v).padStart(2, '0') }

function getResultsApproved(election) {
  if (!election) return false
  return (
    election.results_approved === true ||
    election.is_results_approved === true ||
    election.resultsApproved === true ||
    (typeof election.results_status === 'string' && election.results_status.toLowerCase() === 'approved')
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const mountedRef = useRef(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [election, setElection] = useState(null)
  const [votedPositions, setVotedPositions] = useState(0)
  const [totalPositions, setTotalPositions] = useState(0)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data, error: qErr } = await supabase
        .from('elections').select('*').eq('is_active', true)
        .order('end_time', { ascending: true }).limit(1).maybeSingle()

      if (!mountedRef.current) return

      if (qErr) {
        setError('Failed to load election data.')
        setElection(null)
        setLoading(false)   // BUG FIX #7 — must call setLoading even on error
        return
      }

      setElection(data ?? null)

      if (data) {
        const { data: positions } = await supabase
          .from('positions').select('id').eq('election_id', data.id)

        if (!mountedRef.current) return   // BUG FIX #6 — check mounted after each await

        const posCount = (positions ?? []).length
        setTotalPositions(posCount)

        if (posCount > 0 && user?.id) {
          // BUG FIX #4 — try both 'voter_id' and 'user_id' column names gracefully
          let count = 0
          const { count: c1, error: e1 } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('election_id', data.id)
            .eq('voter_id', user.id)

          if (e1) {
            // column may be user_id instead
            const { count: c2 } = await supabase
              .from('votes')
              .select('*', { count: 'exact', head: true })
              .eq('election_id', data.id)
              .eq('user_id', user.id)
            count = c2 ?? 0
          } else {
            count = c1 ?? 0
          }

          if (!mountedRef.current) return
          setVotedPositions(count)
        }
      }

      if (mountedRef.current) setLoading(false)
    }
    load()
  }, [user?.id])

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Student'
  const studentId = user?.user_metadata?.student_id ?? user?.email?.split('@')[0] ?? '--'
  const electionTitle = election?.title ?? election?.name ?? 'Student Union Government Elections'
  const endAt = election?.end_time ? new Date(election.end_time) : null
  const endAtMs = endAt ? endAt.getTime() : null
  const hasEnded = Boolean(endAtMs && nowMs >= endAtMs)
  const resultsApproved = getResultsApproved(election)

  const countdown = useMemo(() => {
    if (!endAtMs) return { days: '00', hours: '00', minutes: '00', seconds: '00' }
    const rem = Math.max(0, endAtMs - nowMs)
    const total = Math.floor(rem / 1000)
    return {
      days: pad(Math.floor(total / 86400)),
      hours: pad(Math.floor((total % 86400) / 3600)),
      minutes: pad(Math.floor((total % 3600) / 60)),
      seconds: pad(total % 60),
    }
  }, [endAtMs, nowMs])

  const votingProgress = totalPositions > 0 ? Math.round((votedPositions / totalPositions) * 100) : 0
  const isFullyVoted = votedPositions >= totalPositions && totalPositions > 0

  const handleLogout = async () => { try { await logout() } finally { navigate('/login') } }

  if (loading) return (
    <div style={styles.loadingPage}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={styles.loadingSpinner} />
      <p style={styles.loadingText}>Loading your dashboard...</p>
    </div>
  )

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes barFill{from{width:0}to{width:var(--w)}}
        .nav-btn:hover{background:rgba(26,86,219,0.08)!important;color:#1a56db!important}
        .vote-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 32px rgba(26,86,219,0.4)!important}
        .results-btn:hover{border-color:#1a56db!important;color:#1a56db!important}
        .time-box:hover .time-val{color:#1a56db!important}
      `}</style>

      {/* Navbar */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.navLeft}>
            <div style={styles.navLogo}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#1a56db"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={styles.navBrand}>UniVote</span>
          </div>
          <div style={styles.navRight}>
            <div style={styles.navProfile}>
              <div style={styles.navAvatar}>{userName.charAt(0).toUpperCase()}</div>
              <div style={styles.navProfileText}>
                <span style={styles.navName}>{userName}</span>
                <span style={styles.navId}>ID: {studentId}</span>
              </div>
            </div>
            <button className="nav-btn" onClick={handleLogout} style={styles.navLogoutBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main style={styles.main}>
        {/* Welcome */}
        <section style={styles.welcomeSection}>
          <div>
            <h1 style={styles.welcomeTitle}>Welcome back, {userName.split(' ')[0]} 👋</h1>
            <p style={styles.welcomeSub}>
              {!election ? 'No active election at this time.' :
               hasEnded ? 'Voting has closed for this election.' :
               isFullyVoted ? 'You have completed your ballot!' :
               `You have voted in ${votedPositions} of ${totalPositions} positions.`}
            </p>
          </div>
          {error && <div style={styles.errorAlert}>{error}</div>}
        </section>

        {/* Main hero card */}
        {election && (
          <section style={styles.heroCard}>
            <div style={styles.heroLeft}>
              <div style={styles.electionStatusRow}>
                {!hasEnded ? (
                  <span style={styles.livePill}>
                    <span style={styles.liveDot} />
                    LIVE
                  </span>
                ) : (
                  <span style={styles.endedPill}>ENDED</span>
                )}
                <span style={styles.electionMeta}>{election?.title ? 'Active Election' : 'Student Union Elections'}</span>
              </div>
              <h2 style={styles.electionTitle}>{electionTitle}</h2>

              {/* Progress */}
              {!hasEnded && totalPositions > 0 && (
                <div style={styles.progressSection}>
                  <div style={styles.progressHeader}>
                    <span style={styles.progressLabel}>Your voting progress</span>
                    <span style={styles.progressCount}>{votedPositions}/{totalPositions} positions</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${votingProgress}%` }} />
                  </div>
                  {isFullyVoted && (
                    <p style={styles.completedText}>✅ Ballot complete! Thank you for participating.</p>
                  )}
                </div>
              )}

              <div style={styles.heroActions}>
                {!hasEnded && (
                  <button
                    className="vote-btn"
                    onClick={() => navigate('/vote')}
                    disabled={isFullyVoted}
                    style={{ ...styles.primaryVoteBtn, ...(isFullyVoted ? styles.disabledBtn : {}) }}
                  >
                    {isFullyVoted ? (
                      <>✅ Ballot Submitted</>
                    ) : (
                      <>
                        {votedPositions > 0 ? 'Continue Voting' : 'Proceed to Vote'}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </>
                    )}
                  </button>
                )}
                {hasEnded && resultsApproved && (
                  <button className="results-btn" onClick={() => navigate('/results')} style={styles.resultsBtn}>
                    View Official Results →
                  </button>
                )}
                {hasEnded && !resultsApproved && (
                  <div style={styles.pendingBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Results pending official approval
                  </div>
                )}
              </div>
            </div>

            <div style={styles.heroRight}>
              <p style={styles.countdownLabel}>
                {hasEnded ? 'Election ended' : 'Time remaining'}
              </p>
              <div style={styles.timeGrid}>
                {[
                  { val: countdown.days, label: 'DAYS' },
                  { val: countdown.hours, label: 'HRS' },
                  { val: countdown.minutes, label: 'MIN' },
                  { val: countdown.seconds, label: 'SEC' },
                ].map((t, i) => (
                  <div key={i} className="time-box" style={styles.timeBox}>
                    <span className="time-val" style={{ ...styles.timeVal, ...(hasEnded ? { color: '#9ca3af' } : {}) }}>{t.val}</span>
                    <span style={styles.timeUnit}>{t.label}</span>
                  </div>
                ))}
              </div>
              {endAt && (
                <p style={styles.closingTime}>
                  {hasEnded ? 'Closed' : 'Closes'} {endAt.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })} at {endAt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </section>
        )}

        {!election && !loading && (
          <section style={styles.noElectionCard}>
            <div style={styles.noElectionIcon}>🗳️</div>
            <h3 style={styles.noElectionTitle}>No Active Election</h3>
            <p style={styles.noElectionText}>There are no elections currently running. Check back later.</p>
          </section>
        )}

        {/* Info cards */}
        <section style={styles.infoGrid}>
          <div style={styles.infoCard}>
            <div style={styles.infoIconWrap} data-color="blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h4 style={styles.infoTitle}>One Vote Per Position</h4>
            <p style={styles.infoText}>Your vote is cryptographically sealed and cannot be changed or undone once submitted.</p>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <h4 style={styles.infoTitle}>Anonymous Ballots</h4>
            <p style={styles.infoText}>Your identity is decoupled from your vote. No one — including admins — can trace your choices.</p>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <h4 style={styles.infoTitle}>Transparent Tallying</h4>
            <p style={styles.infoText}>Results are published only after official certification by the Elections Commission.</p>
          </div>
        </section>
      </main>
    </div>
  )
}


const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Sora', sans-serif",
    color: '#0f172a',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f8fafc',
    fontFamily: "'Sora', sans-serif",
    gap: '1rem',
  },
  loadingSpinner: {
    width: '36px', height: '36px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#1a56db',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#6b7280', fontWeight: '600', margin: 0 },
  nav: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    height: '68px',
    display: 'flex',
    alignItems: 'center',
  },
  navInner: {
    width: 'min(1200px, 94%)',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  navLogo: {
    width: '36px', height: '36px',
    background: 'rgba(26,86,219,0.08)',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  navBrand: { fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' },
  navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  navProfile: { display: 'flex', alignItems: 'center', gap: '10px' },
  navAvatar: {
    width: '36px', height: '36px',
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '0.9rem',
  },
  navProfileText: { display: 'flex', flexDirection: 'column' },
  navName: { fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', lineHeight: 1.2 },
  navId: { fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.2 },
  navLogoutBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '7px 12px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.15s, color 0.15s',
  },
  main: {
    width: 'min(1200px, 94%)',
    margin: '0 auto',
    padding: '2rem 0 3rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  welcomeSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  welcomeTitle: {
    margin: '0 0 0.35rem',
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  welcomeSub: { margin: 0, color: '#6b7280', fontSize: '0.95rem' },
  errorAlert: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  heroCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    padding: '2rem',
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04)',
  },
  heroLeft: { flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  electionStatusRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  livePill: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#dcfce7', color: '#15803d',
    borderRadius: '999px', padding: '4px 12px',
    fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em',
  },
  liveDot: {
    width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a',
  },
  endedPill: {
    background: '#f3f4f6', color: '#6b7280',
    borderRadius: '999px', padding: '4px 12px',
    fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em',
  },
  electionMeta: { color: '#6b7280', fontSize: '0.85rem', fontWeight: '500' },
  electionTitle: {
    margin: 0, fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)',
    fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em',
  },
  progressSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#6b7280', fontSize: '0.82rem', fontWeight: '600' },
  progressCount: { color: '#1a56db', fontSize: '0.82rem', fontWeight: '700' },
  progressTrack: {
    height: '8px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: 'linear-gradient(90deg, #1a56db, #6366f1)',
    borderRadius: '999px', transition: 'width 0.6s ease',
  },
  completedText: { margin: 0, color: '#059669', fontSize: '0.82rem', fontWeight: '600' },
  heroActions: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  primaryVoteBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: '#fff', padding: '12px 24px',
    fontSize: '0.95rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 16px rgba(26,86,219,0.25)',
  },
  disabledBtn: {
    background: '#f3f4f6', color: '#6b7280',
    boxShadow: 'none', cursor: 'not-allowed',
  },
  resultsBtn: {
    background: 'transparent', border: '2px solid #1a56db',
    borderRadius: '12px', color: '#1a56db',
    padding: '10px 20px', fontSize: '0.9rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s, color 0.15s',
  },
  pendingBadge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: '#d97706', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '8px',
    padding: '8px 14px', fontSize: '0.82rem', fontWeight: '600',
  },
  heroRight: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    alignItems: 'flex-end', justifyContent: 'center',
    minWidth: '220px',
  },
  countdownLabel: {
    margin: 0, color: '#6b7280', fontSize: '0.78rem',
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  timeGrid: { display: 'flex', gap: '8px' },
  timeBox: {
    background: '#f8fafc', border: '1px solid #e5e7eb',
    borderRadius: '12px', padding: '12px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: '56px', transition: 'border-color 0.2s',
  },
  timeVal: {
    display: 'block', fontSize: '1.6rem', fontWeight: '800',
    color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1,
    fontVariantNumeric: 'tabular-nums', transition: 'color 0.2s',
  },
  timeUnit: {
    display: 'block', fontSize: '0.65rem', fontWeight: '700',
    color: '#9ca3af', letterSpacing: '0.08em', marginTop: '4px',
  },
  closingTime: { margin: 0, color: '#9ca3af', fontSize: '0.75rem', textAlign: 'right' },
  noElectionCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '20px', padding: '3rem',
    textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  noElectionIcon: { fontSize: '2.5rem', marginBottom: '1rem' },
  noElectionTitle: { margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' },
  noElectionText: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  infoCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  infoIconWrap: {
    width: '44px', height: '44px',
    background: 'rgba(26,86,219,0.08)',
    borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' },
  infoText: { margin: 0, color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.6 },
}