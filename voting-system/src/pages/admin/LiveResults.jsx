import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function getElectionTitle(election) {
  return election?.title ?? election?.name ?? 'Election'
}

function isElectionEnded(election) {
  if (!election) return false
  if (election.is_active === false) return true
  if (!election.end_time) return false
  return Date.now() >= new Date(election.end_time).getTime()
}

function flattenRows(data) {
  if (!Array.isArray(data)) return []

  const rows = []

  data.forEach((item) => {
    if (Array.isArray(item?.candidates)) {
      item.candidates.forEach((candidate) => {
        rows.push({
          ...candidate,
          position_id:
            candidate?.position_id ??
            candidate?.positionId ??
            item?.position_id ??
            item?.id,
          position_title:
            candidate?.position_title ??
            candidate?.position_name ??
            item?.position_title ??
            item?.position_name ??
            item?.title,
        })
      })
      return
    }

    rows.push(item)
  })

  return rows
}

function groupLiveResults(rawRows) {
  const groups = new Map()

  flattenRows(rawRows).forEach((row) => {
    const positionId = row?.position_id ?? row?.positionId ?? row?.position ?? row?.office_id
    const positionTitle =
      row?.position_title ??
      row?.position_name ??
      row?.position ??
      row?.office_name ??
      'Position'
    const key = `${positionId ?? positionTitle}`

    if (!groups.has(key)) {
      groups.set(key, {
        positionId: positionId ?? key,
        positionTitle,
        candidates: [],
      })
    }

    groups.get(key).candidates.push({
      id: row?.candidate_id ?? row?.candidateId ?? row?.id ?? `${key}-${Math.random()}`,
      name:
        row?.candidate_name ??
        row?.full_name ??
        row?.name ??
        [row?.first_name, row?.last_name].filter(Boolean).join(' ') ??
        'Unnamed Candidate',
      votes: toNumber(row?.vote_count ?? row?.votes ?? row?.total_votes),
    })
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      candidates: [...group.candidates].sort((a, b) => b.votes - a.votes),
    }))
    .sort((a, b) => a.positionTitle.localeCompare(b.positionTitle))
}

export default function LiveResults() {
  const navigate = useNavigate()

  const [election, setElection] = useState(null)
  const [groupedResults, setGroupedResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)

  const ended = useMemo(() => isElectionEnded(election), [election])
  const approved = Boolean(election?.results_approved)

  const loadLiveResults = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true)
      setError('')

      const { data: activeElection, error: activeError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeError) {
        setError(activeError.message || 'Failed to load election.')
        setElection(null)
        setGroupedResults([])
        setLoading(false)
        return
      }

      let targetElection = activeElection

      if (!targetElection) {
        const { data: latestElection, error: latestError } = await supabase
          .from('elections')
          .select('*')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestError) {
          setError(latestError.message || 'Failed to load latest election.')
          setElection(null)
          setGroupedResults([])
          setLoading(false)
          return
        }

        targetElection = latestElection ?? null
      }

      setElection(targetElection)

      if (!targetElection) {
        setGroupedResults([])
        setLoading(false)
        return
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_election_results',
        { p_election_id: targetElection.id }
      )

      if (rpcError) {
        setError(rpcError.message || 'Failed to load live vote counts.')
        setGroupedResults([])
        setLoading(false)
        return
      }

      setGroupedResults(groupLiveResults(rpcData))
      setLoading(false)
    },
    []
  )

  useEffect(() => {
    loadLiveResults(true)
  }, [loadLiveResults])

  useEffect(() => {
    if (!election || ended) return undefined

    const timer = setInterval(() => {
      loadLiveResults(false)
    }, 10000)

    return () => clearInterval(timer)
  }, [election, ended, loadLiveResults])

  const handleApproveResults = async () => {
    if (!election?.id || approved) return

    setApproving(true)
    setError('')

    const { error: approveError } = await supabase
      .from('elections')
      .update({ results_approved: true, is_active: false })
      .eq('id', election.id)

    if (approveError) {
      setError(approveError.message || 'Failed to approve results.')
      setApproving(false)
      return
    }

    setApproving(false)
    await loadLiveResults(false)
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Live Results</h1>
          <p style={styles.subtitle}>
            {election ? getElectionTitle(election) : 'No election selected'}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={() => navigate('/admin')}>
            Back to Dashboard
          </button>
          {ended ? (
            <button
              style={{ ...styles.primaryButton, ...(approved ? styles.disabled : {}) }}
              onClick={handleApproveResults}
              disabled={approved || approving}
            >
              {approved ? 'Results Approved' : approving ? 'Approving...' : 'Approve Results'}
            </button>
          ) : null}
        </div>
      </header>

      <div style={styles.banner}>Unofficial Results - Monitoring Only</div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading live vote counts...</p>
        </div>
      ) : groupedResults.length === 0 ? (
        <div style={styles.empty}>No live results available.</div>
      ) : (
        <section style={styles.stack}>
          {groupedResults.map((group) => (
            <article key={group.positionId} style={styles.card}>
              <h2 style={styles.positionTitle}>Position: {group.positionTitle}</h2>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Candidate</th>
                      <th style={styles.th}>Live Vote Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.candidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td style={styles.td}>{candidate.name}</td>
                        <td style={styles.td}>{candidate.votes.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      )}

      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#eef2f7',
    color: '#0b234e',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    padding: '1.2rem',
    display: 'grid',
    gap: '0.8rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: '#566c93',
  },
  headerActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 0,
    background: '#08255d',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.62rem 0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #c3d0e3',
    background: '#fff',
    color: '#08255d',
    borderRadius: '8px',
    padding: '0.62rem 0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  banner: {
    background: '#fff4dc',
    color: '#8b5e00',
    border: '1px solid #f0d7a4',
    borderRadius: '10px',
    padding: '0.65rem 0.8rem',
    fontWeight: 700,
  },
  error: {
    margin: 0,
    color: '#b42318',
    fontWeight: 600,
  },
  loadingWrap: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    minHeight: '180px',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '0.35rem',
  },
  spinner: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    border: '3px solid #c9d5e8',
    borderTopColor: '#08255d',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: '#5a7198',
    fontWeight: 700,
  },
  empty: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '1rem',
    color: '#5a7198',
    textAlign: 'center',
  },
  stack: {
    display: 'grid',
    gap: '0.8rem',
  },
  card: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '0.8rem',
    display: 'grid',
    gap: '0.55rem',
  },
  positionTitle: {
    margin: 0,
    fontSize: '1.15rem',
    color: '#0f2a58',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: '500px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontWeight: 700,
    padding: '0.6rem',
    borderBottom: '1px solid #d6dfed',
    color: '#2d4671',
    background: '#edf3fb',
  },
  td: {
    padding: '0.6rem',
    borderBottom: '1px solid #e0e7f3',
  },
}
