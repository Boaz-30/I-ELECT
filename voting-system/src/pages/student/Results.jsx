import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function isApproved(e) {
  if (!e) return false
  return e.results_approved === true || e.is_results_approved === true ||
    e.resultsApproved === true ||
    (typeof e.results_status === 'string' && e.results_status.toLowerCase() === 'approved')
}
// BUG FIX #23 — renamed from electionTitle to getElectionTitle to prevent confusion with `election` state
function getElectionTitle(e) { return e?.title ?? e?.name ?? 'Official Election Results' }

function flattenRows(data) {
  if (!Array.isArray(data)) return []
  const rows = []
  data.forEach(item => {
    if (Array.isArray(item?.candidates)) {
      item.candidates.forEach(c => rows.push({
        ...c,
        position_id: c?.position_id ?? c?.positionId ?? item?.position_id ?? item?.id,
        position_title: c?.position_title ?? c?.position_name ?? item?.position_title ?? item?.title,
      }))
      return
    }
    rows.push(item)
  })
  return rows
}

function groupResults(rawRows) {
  const groups = new Map()
  flattenRows(rawRows).forEach(row => {
    const posId = row?.position_id ?? row?.positionId ?? row?.position ?? row?.office_id
    const posTitle = row?.position_title ?? row?.position_name ?? row?.position ?? 'Position'
    const key = `${posId ?? posTitle}`
    if (!groups.has(key)) groups.set(key, { positionId: posId ?? key, positionTitle: posTitle, candidates: [] })
    groups.get(key).candidates.push({
      id: row?.candidate_id ?? row?.candidateId ?? row?.id ?? Math.random(),
      name: row?.candidate_name ?? row?.full_name ?? row?.name ??
        [row?.first_name, row?.last_name].filter(Boolean).join(' ') ?? 'Unnamed',
      voteCount: toNumber(row?.vote_count ?? row?.votes ?? row?.total_votes),
      photoUrl: row?.photo_url ?? row?.image_url ?? row?.avatar_url ?? '',
      percentage: row?.percentage ?? row?.vote_percentage ?? row?.percent ?? null,
    })
  })
  return Array.from(groups.values()).map(g => {
    const sorted = [...g.candidates].sort((a, b) => b.voteCount - a.voteCount)
    const total = sorted.reduce((s, c) => s + toNumber(c.voteCount), 0)
    return {
      ...g,
      totalVotes: total,
      candidates: sorted.map(c => ({
        ...c,
        percentage: c.percentage == null
          ? (total > 0 ? (toNumber(c.voteCount) / total) * 100 : 0)
          : toNumber(c.percentage),
      })),
    }
  }).sort((a, b) => a.positionTitle.localeCompare(b.positionTitle))
}

const COLORS = ['#1a56db', '#059669', '#7c3aed', '#dc2626', '#d97706']

export default function Results() {
  const navigate = useNavigate()
  const mountedRef = useRef(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [election, setElection] = useState(null)
  const [positionResults, setPositionResults] = useState([])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(''); setAccessDenied(false)
      const { data: current, error: eErr } = await supabase
        .from('elections').select('*')
        .order('is_active', { ascending: false })
        .order('end_time', { ascending: false }).limit(1).maybeSingle()

      if (!mountedRef.current) return
      if (eErr) { setError('Failed to load election.'); setLoading(false); return }
      if (!current) { setError('No election found.'); setLoading(false); return }
      setElection(current)

      if (!isApproved(current)) { setAccessDenied(true); setLoading(false); return }

      const { data: rows, error: rErr } = await supabase.rpc('get_election_results', { p_election_id: current.id })
      if (!mountedRef.current) return
      if (rErr) { setError(rErr.message || 'Failed to fetch results.'); setLoading(false); return }
      // BUG FIX #21 — null-guard rows before passing to groupResults (RPC can return null)
      setPositionResults(groupResults(rows ?? []))
      setLoading(false)
    }
    load()
  }, [])

  const totalVotes = useMemo(() =>
    positionResults.reduce((s, g) => s + toNumber(g.totalVotes), 0), [positionResults])

  if (loading) return (
    <div style={st.loadingPage}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <div style={st.spinner} />
      <p style={st.loadingText}>Loading official results...</p>
    </div>
  )

  if (accessDenied) return (
    <div style={st.accessDeniedPage}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');`}</style>
      <div style={st.accessCard}>
        <div style={st.accessIcon}>🔒</div>
        <h2 style={st.accessTitle}>Results Not Yet Available</h2>
        <p style={st.accessText}>The election results are pending official approval by the Elections Commission. Please check back later.</p>
        <button onClick={() => navigate('/dashboard')} style={st.accessBtn}>
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div style={st.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes barGrow{from{width:0}to{width:var(--target-width)}}
        .print-btn:hover{background:#f3f4f6!important}
        .back-btn:hover{background:rgba(26,86,219,0.08)!important;border-color:#1a56db!important}
        @media print{
          .no-print{display:none!important}
          body{background:white}
        }
      `}</style>

      {/* Header */}
      <header style={st.header} className="no-print">
        <div style={st.headerLeft}>
          <div style={st.headerLogo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#1a56db"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={st.headerBrand}>UniVote · Official Results</span>
        </div>
        <div style={st.headerRight}>
          <button className="print-btn" onClick={() => window.print()} style={st.printBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print
          </button>
          <button className="back-btn" onClick={() => navigate('/dashboard')} style={st.backBtn}>
            ← Dashboard
          </button>
        </div>
      </header>

      <main style={st.main}>
        {/* Hero */}
        <section style={st.hero}>
          <div style={st.heroInner}>
            <div style={st.certifiedBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Certified Official Results
            </div>
            <h1 style={st.heroTitle}>{getElectionTitle(election)}</h1>
            <p style={st.heroSubtitle}>
              {totalVotes.toLocaleString()} total votes cast across {positionResults.length} positions
            </p>
            {error && <p style={st.heroError}>{error}</p>}
          </div>
        </section>

        {/* Results */}
        {positionResults.length === 0 ? (
          <div style={st.emptyCard}>
            <div style={st.emptyIcon}>📊</div>
            <p style={st.emptyText}>No result data available.</p>
          </div>
        ) : (
          <div style={st.resultsStack}>
            {positionResults.map((group, gIdx) => (
              <section key={group.positionId} style={{ ...st.groupSection, animationDelay: `${gIdx * 0.08}s` }}>
                <div style={st.groupHeader}>
                  <div style={st.groupHeaderLeft}>
                    <span style={st.groupIndex}>{String(gIdx + 1).padStart(2, '0')}</span>
                    <div>
                      <p style={st.groupMeta}>{group.totalVotes.toLocaleString()} votes cast</p>
                      <h2 style={st.groupTitle}>{group.positionTitle}</h2>
                    </div>
                  </div>
                </div>

                {/* Winner spotlight */}
                {group.candidates.length > 0 && (
                  <div style={st.winnerSpotlight}>
                    <div style={st.winnerLeft}>
                      {group.candidates[0].photoUrl ? (
                        <img src={group.candidates[0].photoUrl} alt={group.candidates[0].name} style={st.winnerPhoto} />
                      ) : (
                        <div style={st.winnerAvatar}>{group.candidates[0].name.charAt(0).toUpperCase()}</div>
                      )}
                      <div>
                        <p style={st.winnerELECTED}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          ELECTED
                        </p>
                        <p style={st.winnerName}>{group.candidates[0].name}</p>
                        <p style={st.winnerStats}>
                          {group.candidates[0].voteCount.toLocaleString()} votes · {group.candidates[0].percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div style={st.winnerBar}>
                      <div style={{ ...st.winnerBarFill, width: `${Math.min(100, group.candidates[0].percentage)}%` }} />
                    </div>
                  </div>
                )}

                {/* All candidates */}
                <div style={st.candidateList}>
                  {group.candidates.map((candidate, i) => {
                    const isWinner = i === 0
                    const color = COLORS[i % COLORS.length]
                    return (
                      <div key={candidate.id} style={st.candidateRow}>
                        <div style={st.candidateLeft}>
                          <span style={{ ...st.rank, background: isWinner ? '#fef3c7' : '#f3f4f6', color: isWinner ? '#92400e' : '#9ca3af' }}>
                            {i + 1}
                          </span>
                          {candidate.photoUrl ? (
                            <img src={candidate.photoUrl} alt={candidate.name} style={st.candidatePic} />
                          ) : (
                            <div style={{ ...st.candidateAv, background: `${color}18`, color }}>{candidate.name.charAt(0)}</div>
                          )}
                          <div>
                            <p style={st.candidateName}>{candidate.name}</p>
                            <p style={st.candidateVotes}>{candidate.voteCount.toLocaleString()} votes</p>
                          </div>
                          {isWinner && <span style={st.electedTag}>Elected</span>}
                        </div>
                        <div style={st.barSection}>
                          <div style={st.barTrack}>
                            <div style={{ ...st.barFill, width: `${Math.max(candidate.percentage, 0.5)}%`, background: color }} />
                          </div>
                          <span style={st.pctText}>{candidate.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer style={st.footer}>
        <div style={st.footerInner}>
          <p>© 2025 University of Ghana Students' Representative Council</p>
          <p style={st.footerSub}>Results certified by the Electoral Commission · All votes are final and audited</p>
        </div>
      </footer>
    </div>
  )
}

const st = {
  page: {
    minHeight: '100vh', background: '#f8fafc',
    fontFamily: "'Sora', sans-serif", color: '#0f172a',
  },
  loadingPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#f8fafc', fontFamily: "'Sora', sans-serif",
    gap: '1rem', alignContent: 'center',
  },
  spinner: {
    width: '36px', height: '36px', border: '3px solid #e5e7eb',
    borderTopColor: '#1a56db', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { margin: 0, color: '#6b7280', fontWeight: '600' },
  accessDeniedPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#f8fafc', fontFamily: "'Sora', sans-serif",
    padding: '2rem',
  },
  accessCard: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '24px',
    padding: '3rem', maxWidth: '440px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  },
  accessIcon: { fontSize: '2.5rem' },
  accessTitle: { margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' },
  accessText: { margin: 0, color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.65 },
  accessBtn: {
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: '#fff', padding: '12px 24px',
    fontSize: '0.9rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
  },
  header: {
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '0 2rem', height: '68px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerLogo: {
    width: '36px', height: '36px', background: 'rgba(26,86,219,0.08)',
    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerBrand: { fontSize: '1rem', fontWeight: '800', color: '#0f172a' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  printBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '8px 14px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s',
  },
  backBtn: {
    background: 'transparent', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '8px 14px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s, border-color 0.12s',
  },
  main: {
    width: 'min(1000px, 94%)', margin: '0 auto',
    padding: '2rem 0 4rem', display: 'flex', flexDirection: 'column', gap: '2rem',
  },
  hero: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
    borderRadius: '24px', padding: '3rem', overflow: 'hidden', position: 'relative',
  },
  heroInner: { position: 'relative', zIndex: 1 },
  certifiedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '999px', padding: '5px 14px',
    fontSize: '0.75rem', fontWeight: '700', marginBottom: '1rem',
    letterSpacing: '0.04em',
  },
  heroTitle: {
    margin: '0 0 0.75rem', color: '#fff',
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1.05,
  },
  heroSubtitle: {
    margin: 0, color: 'rgba(255,255,255,0.65)',
    fontSize: '1rem', fontWeight: '400',
  },
  heroError: { margin: '0.75rem 0 0', color: '#fca5a5', fontWeight: '600' },
  emptyCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', padding: '3rem', textAlign: 'center',
  },
  emptyIcon: { fontSize: '2rem', marginBottom: '0.75rem' },
  emptyText: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  resultsStack: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  groupSection: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '20px', overflow: 'hidden',
    animation: 'fadeUp 0.4s ease both',
  },
  groupHeader: {
    padding: '1.5rem 1.5rem 0',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem',
  },
  groupHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  groupIndex: {
    width: '36px', height: '36px', background: '#f3f4f6',
    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', fontWeight: '800', color: '#6b7280', flexShrink: 0, marginTop: '2px',
  },
  groupMeta: {
    margin: '0 0 2px', fontSize: '0.72rem', fontWeight: '700',
    color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  groupTitle: { margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' },
  winnerSpotlight: {
    margin: '1.25rem 1.5rem',
    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    borderRadius: '16px', padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '12px',
    border: '1px solid #fcd34d',
  },
  winnerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  winnerPhoto: {
    width: '56px', height: '56px', borderRadius: '14px',
    objectFit: 'cover', border: '2px solid rgba(212,175,55,0.4)', flexShrink: 0,
  },
  winnerAvatar: {
    width: '56px', height: '56px', borderRadius: '14px',
    background: '#fbbf24', color: '#92400e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.35rem', fontWeight: '900', flexShrink: 0,
  },
  winnerELECTED: {
    margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: '5px',
    fontSize: '0.7rem', fontWeight: '800', color: '#92400e',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  winnerName: { margin: '0 0 3px', fontSize: '1.2rem', fontWeight: '800', color: '#78350f' },
  winnerStats: { margin: 0, color: '#b45309', fontSize: '0.82rem', fontWeight: '600' },
  winnerBar: {
    height: '6px', background: 'rgba(120,53,15,0.1)',
    borderRadius: '999px', overflow: 'hidden',
  },
  winnerBarFill: {
    height: '100%', background: '#d97706',
    borderRadius: '999px', transition: 'width 0.8s ease',
  },
  candidateList: {
    padding: '0 1.5rem 1.5rem',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  candidateRow: {
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  candidateLeft: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
  },
  rank: {
    width: '26px', height: '26px', borderRadius: '7px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', fontWeight: '800', flexShrink: 0,
  },
  candidatePic: {
    width: '38px', height: '38px', borderRadius: '10px',
    objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0,
  },
  candidateAv: {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', fontWeight: '800', flexShrink: 0,
  },
  candidateName: { margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' },
  candidateVotes: { margin: 0, fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' },
  electedTag: {
    background: '#dcfce7', color: '#15803d', borderRadius: '999px',
    padding: '2px 9px', fontSize: '0.68rem', fontWeight: '700',
    whiteSpace: 'nowrap', marginLeft: 'auto',
  },
  barSection: { display: 'flex', alignItems: 'center', gap: '10px' },
  barTrack: {
    flex: 1, height: '7px', background: '#f3f4f6',
    borderRadius: '999px', overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: '999px',
    transition: 'width 0.7s ease',
  },
  pctText: { fontSize: '0.78rem', fontWeight: '700', color: '#374151', minWidth: '40px', textAlign: 'right' },
  footer: {
    background: '#0f172a', padding: '2rem',
    borderTop: '1px solid #1e293b', marginTop: '2rem',
  },
  footerInner: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' },
  footerSub: { marginTop: '4px', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' },
}