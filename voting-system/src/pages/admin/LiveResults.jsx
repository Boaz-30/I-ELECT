import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function getElectionTitle(e) { return e?.title ?? e?.name ?? 'Election' }
function isElectionEnded(e) {
  if (!e) return false
  if (e.is_active === false) return true
  if (!e.end_time) return false
  return Date.now() >= new Date(e.end_time).getTime()
}

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

function groupLiveResults(rawRows) {
  const groups = new Map()
  flattenRows(rawRows).forEach(row => {
    const positionId = row?.position_id ?? row?.positionId ?? row?.position ?? row?.office_id
    const positionTitle = row?.position_title ?? row?.position_name ?? row?.position ?? 'Position'
    const key = `${positionId ?? positionTitle}`
    if (!groups.has(key)) groups.set(key, { positionId: positionId ?? key, positionTitle, candidates: [] })
    groups.get(key).candidates.push({
      id: row?.candidate_id ?? row?.candidateId ?? row?.id ?? Math.random(),
      name: row?.candidate_name ?? row?.full_name ?? row?.name ??
        [row?.first_name, row?.last_name].filter(Boolean).join(' ') ?? 'Unnamed',
      votes: toNumber(row?.vote_count ?? row?.votes ?? row?.total_votes),
    })
  })
  return Array.from(groups.values())
    .map(g => ({ ...g, candidates: [...g.candidates].sort((a, b) => b.votes - a.votes) }))
    .sort((a, b) => a.positionTitle.localeCompare(b.positionTitle))
}

const PALETTE = ['#1a56db', '#059669', '#7c3aed', '#dc2626', '#d97706', '#0891b2', '#be185d']

function ResultCard({ group, index }) {
  const totalVotes = group.candidates.reduce((s, c) => s + c.votes, 0)
  const winner = group.candidates[0]

  return (
    <article style={rc.card}>
      <div style={rc.cardHeader}>
        <div>
          <p style={rc.positionLabel}>Position {String(index + 1).padStart(2, '0')}</p>
          <h3 style={rc.positionTitle}>{group.positionTitle}</h3>
        </div>
        <div style={rc.totalBadge}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {totalVotes.toLocaleString()} votes
        </div>
      </div>

      <div style={rc.candidateList}>
        {group.candidates.map((candidate, i) => {
          const pct = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0
          const isWinner = i === 0
          const color = PALETTE[i % PALETTE.length]
          return (
            <div key={candidate.id} style={rc.candidateRow}>
              <div style={rc.candidateInfo}>
                <div style={{ ...rc.rankBadge, background: isWinner ? '#fef3c7' : '#f3f4f6', color: isWinner ? '#92400e' : '#6b7280' }}>
                  {isWinner ? '🥇' : `#${i + 1}`}
                </div>
                <span style={rc.candidateName}>{candidate.name}</span>
                {isWinner && <span style={rc.winnerTag}>Leading</span>}
              </div>
              <div style={rc.barRow}>
                <div style={rc.barTrack}>
                  <div style={{ ...rc.barFill, width: `${Math.max(pct, 1)}%`, background: color }} />
                </div>
                <div style={rc.voteInfo}>
                  <span style={rc.voteCount}>{candidate.votes.toLocaleString()}</span>
                  <span style={rc.votePct}>{pct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mini chart */}
      {group.candidates.length > 0 && totalVotes > 0 && (
        <div style={rc.miniChart}>
          {group.candidates.map((c, i) => {
            const pct = (c.votes / totalVotes) * 100
            const color = PALETTE[i % PALETTE.length]
            return (
              <div
                key={c.id}
                style={{ ...rc.chartSegment, width: `${pct}%`, background: color }}
                title={`${c.name}: ${pct.toFixed(1)}%`}
              />
            )
          })}
        </div>
      )}
    </article>
  )
}

export default function LiveResults() {
  const navigate = useNavigate()
  const mountedRef = useRef(true)
  const isRefreshingRef = useRef(false)   // BUG FIX #18 — prevent concurrent interval calls

  const [election, setElection] = useState(null)
  const [groupedResults, setGroupedResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)  // BUG FIX #19 — keep as state, set via stable setter

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const ended = useMemo(() => isElectionEnded(election), [election])
  const approved = Boolean(election?.results_approved)

  const totalVotes = useMemo(() =>
    groupedResults.reduce((s, g) =>
      s + g.candidates.reduce((cs, c) => cs + c.votes, 0), 0
    ), [groupedResults])

  // BUG FIX #18 — guard with isRefreshingRef so concurrent interval ticks are dropped
  // BUG FIX #19 — setLastUpdated(new Date()) is called after all awaits resolve, not inside stale closure
  const load = useCallback(async (showLoader = false) => {
    if (isRefreshingRef.current) return   // already in-flight, skip
    isRefreshingRef.current = true

    if (showLoader) setLoading(true)
    setError('')

    const { data: active, error: aErr } = await supabase
      .from('elections').select('*').eq('is_active', true)
      .order('start_time', { ascending: false }).limit(1).maybeSingle()

    if (!mountedRef.current) { isRefreshingRef.current = false; return }
    if (aErr) {
      setError(aErr.message || 'Failed to load election.')
      setLoading(false)
      isRefreshingRef.current = false
      return
    }

    let target = active
    if (!target) {
      const { data: latest } = await supabase
        .from('elections').select('*').order('end_time', { ascending: false }).limit(1).maybeSingle()
      target = latest ?? null
    }

    if (!mountedRef.current) { isRefreshingRef.current = false; return }
    setElection(target)

    if (!target) {
      setGroupedResults([])
      setLoading(false)
      isRefreshingRef.current = false
      return
    }

    // BUG FIX #20 — guard against null rpcData explicitly before passing to groupLiveResults
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_election_results', { p_election_id: target.id })

    if (!mountedRef.current) { isRefreshingRef.current = false; return }
    if (rpcErr) {
      setError(rpcErr.message || 'Failed to load results.')
      setLoading(false)
      isRefreshingRef.current = false
      return
    }

    setGroupedResults(groupLiveResults(rpcData ?? []))
    setLastUpdated(new Date())   // safe: called after all awaits, not inside closure
    setLoading(false)
    isRefreshingRef.current = false
  }, [])  // stable — no deps change identity

  useEffect(() => { load(true) }, [load])

  useEffect(() => {
    if (!election || ended) return
    const t = setInterval(() => {
      load(false)  // BUG FIX #18 — isRefreshingRef inside load() guards against overlap
    }, 10000)
    return () => clearInterval(t)
  }, [election, ended, load])

  const handleApprove = async () => {
    if (!election?.id || approved) return
    setApproving(true)
    const { error: e } = await supabase
      .from('elections').update({ results_approved: true, is_active: false }).eq('id', election.id)
    if (!mountedRef.current) return
    if (e) { setError(e.message || 'Failed to approve results.') }
    setApproving(false)
    await load(false)
  }

  return (
    <div style={st.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes barGrow{from{width:0}to{width:var(--w)}}
        .back-btn:hover{background:rgba(26,86,219,0.08)!important}
        .approve-btn:hover:not(:disabled){background:#1e429f!important;transform:translateY(-1px)}
        .refresh-btn:hover{background:#eff6ff!important;border-color:#1a56db!important}
      `}</style>

      {/* Header */}
      <header style={st.header}>
        <div style={st.headerLeft}>
          <button className="back-btn" onClick={() => navigate('/admin')} style={st.backBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Admin
          </button>
          <div>
            <h1 style={st.title}>Live Results</h1>
            <p style={st.subtitle}>{election ? getElectionTitle(election) : 'No election selected'}</p>
          </div>
        </div>
        <div style={st.headerRight}>
          <button className="refresh-btn" onClick={() => load(true)} style={st.refreshBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
          {ended && (
            <button
              className="approve-btn"
              onClick={handleApprove}
              disabled={approved || approving}
              style={{ ...st.approveBtn, ...(approved || approving ? st.approveDisabled : {}) }}
            >
              {approved ? '✓ Results Approved' : approving ? 'Approving...' : '✓ Approve Results'}
            </button>
          )}
        </div>
      </header>

      <main style={st.main}>
        {/* Unofficial banner */}
        <div style={st.banner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <strong>Unofficial Results</strong> — For monitoring only. Results must be approved before public release.
          {lastUpdated && (
            <span style={st.lastUpdated}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {error && <div style={st.errorAlert}>{error}</div>}

        {/* Summary stats */}
        {!loading && election && (
          <div style={st.summaryRow}>
            <div style={st.summaryCard}>
              <p style={st.summaryLabel}>Total Votes</p>
              <p style={st.summaryValue}>{totalVotes.toLocaleString()}</p>
            </div>
            <div style={st.summaryCard}>
              <p style={st.summaryLabel}>Positions</p>
              <p style={st.summaryValue}>{groupedResults.length}</p>
            </div>
            <div style={st.summaryCard}>
              <p style={st.summaryLabel}>Election Status</p>
              <p style={{ ...st.summaryValue, color: ended ? '#6b7280' : '#059669' }}>
                {ended ? 'Ended' : 'Live'}
              </p>
            </div>
            <div style={st.summaryCard}>
              <p style={st.summaryLabel}>Results</p>
              <p style={{ ...st.summaryValue, color: approved ? '#059669' : '#d97706' }}>
                {approved ? 'Approved' : 'Pending'}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div style={st.loadingCard}>
            <div style={st.spinner} />
            <p style={st.loadingText}>Loading live vote counts...</p>
          </div>
        ) : groupedResults.length === 0 ? (
          <div style={st.emptyCard}>
            <div style={st.emptyIcon}>📊</div>
            <h3 style={st.emptyTitle}>No results yet</h3>
            <p style={st.emptyText}>Vote counts will appear here once voting begins.</p>
          </div>
        ) : (
          <div style={st.resultsGrid}>
            {groupedResults.map((group, i) => (
              <ResultCard key={group.positionId} group={group} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const rc = {
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '20px',
    padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
    animation: 'fadeUp 0.3s ease both',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem',
  },
  positionLabel: {
    margin: '0 0 2px', fontSize: '0.72rem', fontWeight: '700',
    color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  positionTitle: { margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' },
  totalBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: '#f3f4f6', borderRadius: '999px', padding: '5px 12px',
    fontSize: '0.78rem', fontWeight: '600', color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  candidateList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  candidateRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  candidateInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  rankBadge: {
    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', fontWeight: '800',
  },
  candidateName: { fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', flex: 1 },
  winnerTag: {
    background: '#dcfce7', color: '#15803d', borderRadius: '999px',
    padding: '2px 8px', fontSize: '0.7rem', fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  barRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  barTrack: {
    flex: 1, height: '8px', background: '#f3f4f6',
    borderRadius: '999px', overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: '999px',
    transition: 'width 0.6s ease',
  },
  voteInfo: { display: 'flex', gap: '8px', minWidth: '90px', justifyContent: 'flex-end' },
  voteCount: { fontSize: '0.82rem', fontWeight: '700', color: '#374151' },
  votePct: { fontSize: '0.78rem', fontWeight: '600', color: '#9ca3af', minWidth: '38px', textAlign: 'right' },
  miniChart: {
    height: '6px', borderRadius: '999px', overflow: 'hidden',
    display: 'flex', gap: '1px',
  },
  chartSegment: { height: '100%', minWidth: '2px', transition: 'width 0.5s ease' },
}

const st = {
  page: {
    minHeight: '100vh', background: '#f8fafc',
    fontFamily: "'Sora', sans-serif", color: '#0f172a',
  },
  header: {
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '1rem 2rem', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: '1rem',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '7px 12px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s', flexShrink: 0,
  },
  title: { margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' },
  subtitle: { margin: 0, color: '#6b7280', fontSize: '0.82rem' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '8px 14px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s, border-color 0.12s',
  },
  approveBtn: {
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    border: 'none', borderRadius: '10px',
    color: '#fff', padding: '9px 18px',
    fontSize: '0.875rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s, transform 0.15s',
    boxShadow: '0 4px 12px rgba(26,86,219,0.25)',
  },
  approveDisabled: { opacity: 0.6, cursor: 'not-allowed', transform: 'none', boxShadow: 'none' },
  main: {
    width: 'min(1200px, 94%)', margin: '0 auto',
    padding: '2rem 0 3rem', display: 'flex',
    flexDirection: 'column', gap: '1.5rem',
  },
  banner: {
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: '12px', padding: '12px 16px',
    color: '#92400e', fontSize: '0.82rem', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
  },
  lastUpdated: { marginLeft: 'auto', color: '#b45309', fontSize: '0.75rem' },
  errorAlert: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
  },
  summaryCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '14px', padding: '1.25rem',
  },
  summaryLabel: {
    margin: '0 0 0.4rem', color: '#6b7280',
    fontSize: '0.72rem', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  summaryValue: {
    margin: 0, fontSize: '1.75rem', fontWeight: '900',
    color: '#0f172a', letterSpacing: '-0.03em',
  },
  loadingCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', minHeight: '240px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px',
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #e5e7eb',
    borderTopColor: '#1a56db', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { margin: 0, color: '#6b7280', fontWeight: '600', fontSize: '0.875rem' },
  emptyCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', padding: '3rem',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '2.5rem', marginBottom: '1rem' },
  emptyTitle: { margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' },
  emptyText: { margin: 0, color: '#6b7280', fontSize: '0.875rem' },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
    gap: '1.25rem',
  },
}