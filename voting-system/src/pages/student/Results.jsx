import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isResultsApproved(election) {
  if (!election) return false
  if (typeof election.results_approved === 'boolean') return election.results_approved
  if (typeof election.is_results_approved === 'boolean') return election.is_results_approved
  if (typeof election.resultsApproved === 'boolean') return election.resultsApproved
  if (typeof election.results_status === 'string') {
    return election.results_status.toLowerCase() === 'approved'
  }
  return false
}

function electionTitle(election) {
  return election?.title ?? election?.name ?? 'Official Election Results'
}

function flattenRpcRows(data) {
  if (!Array.isArray(data)) return []

  const rows = []
  data.forEach((item) => {
    if (Array.isArray(item?.candidates)) {
      item.candidates.forEach((candidate) => {
        rows.push({
          ...candidate,
          position_id:
            candidate?.position_id ?? candidate?.positionId ?? item?.position_id ?? item?.id,
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

function groupAndSortResults(rawRows) {
  const groups = new Map()

  flattenRpcRows(rawRows).forEach((row) => {
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
      voteCount: toNumber(row?.vote_count ?? row?.votes ?? row?.total_votes),
      percentage: row?.percentage ?? row?.vote_percentage ?? row?.percent ?? null,
      photoUrl: row?.photo_url ?? row?.image_url ?? row?.avatar_url ?? '',
    })
  })

  return Array.from(groups.values())
    .map((group) => {
      const sorted = [...group.candidates].sort((a, b) => b.voteCount - a.voteCount)
      const totalVotes = sorted.reduce((sum, c) => sum + toNumber(c.voteCount), 0)

      const normalized = sorted.map((candidate) => {
        const computedPercentage =
          totalVotes > 0 ? (toNumber(candidate.voteCount) / totalVotes) * 100 : 0
        const percentage =
          candidate.percentage == null ? computedPercentage : toNumber(candidate.percentage)

        return {
          ...candidate,
          percentage,
        }
      })

      return {
        ...group,
        totalVotes,
        candidates: normalized,
      }
    })
    .sort((a, b) => a.positionTitle.localeCompare(b.positionTitle))
}

export default function Results() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [election, setElection] = useState(null)
  const [positionResults, setPositionResults] = useState([])

  useEffect(() => {
    let isMounted = true

    const loadResults = async () => {
      setLoading(true)
      setError('')
      setAccessDenied(false)

      const { data: currentElection, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .order('is_active', { ascending: false })
        .order('end_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!isMounted) return

      if (electionError) {
        setError('Failed to load election.')
        setLoading(false)
        return
      }

      if (!currentElection) {
        setError('No election found.')
        setLoading(false)
        return
      }

      setElection(currentElection)

      if (!isResultsApproved(currentElection)) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      const { data: resultRows, error: resultsError } = await supabase.rpc(
        'get_election_results',
        { p_election_id: currentElection.id }
      )

      if (!isMounted) return

      if (resultsError) {
        setError(resultsError.message || 'Failed to fetch results.')
        setLoading(false)
        return
      }

      setPositionResults(groupAndSortResults(resultRows))
      setLoading(false)
    }

    loadResults()

    return () => {
      isMounted = false
    }
  }, [])

  const totalVotesAcrossPositions = useMemo(() => {
    return positionResults.reduce((sum, group) => sum + toNumber(group.totalVotes), 0)
  }, [positionResults])

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading results...</p>
        <style>
          {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
        </style>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div style={styles.centerPage}>
        <h2 style={styles.centerTitle}>Results Not Available</h2>
        <p style={styles.centerText}>Results are pending approval.</p>
        <button style={styles.primaryBtn} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.brand}>UNIVERSITY VOTING SYSTEM</h1>
        <div style={styles.headerActions}>
          <button style={styles.secondaryBtn} onClick={() => window.print()}>
            Print Results
          </button>
          <button style={styles.primaryBtn} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.headlineWrap}>
          <h2 style={styles.pageTitle}>{electionTitle(election)}</h2>
          <p style={styles.pageSubtitle}>
            Certified official results. Total votes counted: {totalVotesAcrossPositions.toLocaleString()}.
          </p>
          {error ? <p style={styles.errorText}>{error}</p> : null}
        </section>

        {positionResults.length === 0 ? (
          <p style={styles.pageSubtitle}>No result rows returned.</p>
        ) : null}

        {positionResults.map((group) => (
          <section key={group.positionId} style={styles.groupSection}>
            <h3 style={styles.groupTitle}>{group.positionTitle}</h3>

            <div style={styles.candidateStack}>
              {group.candidates.map((candidate, index) => {
                const isWinner = index === 0

                return (
                  <article
                    key={candidate.id}
                    style={{
                      ...styles.candidateCard,
                      ...(isWinner ? styles.winnerCard : {}),
                    }}
                  >
                    <div style={styles.candidateMain}>
                      {candidate.photoUrl ? (
                        <img
                          src={candidate.photoUrl}
                          alt={candidate.name}
                          style={styles.candidatePhoto}
                        />
                      ) : (
                        <div style={styles.photoFallback}>
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div style={styles.candidateInfo}>
                        <div style={styles.candidateTopRow}>
                          <p style={styles.candidateName}>{candidate.name}</p>
                          {isWinner ? <span style={styles.badge}>ELECTED</span> : null}
                        </div>

                        <div style={styles.metricsRow}>
                          <span style={styles.votesText}>
                            {candidate.voteCount.toLocaleString()} votes
                          </span>
                          <span style={styles.percentText}>
                            {candidate.percentage.toFixed(1)}%
                          </span>
                        </div>

                        <div style={styles.progressTrack}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${Math.max(0, Math.min(100, candidate.percentage))}%`,
                              background: isWinner ? '#002147' : '#8da0bc',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f1f4f8',
    color: '#0b234f',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: '#fff',
    borderBottom: '1px solid #d8dfeb',
    padding: '0.9rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  brand: {
    margin: 0,
    fontSize: '1.5rem',
    letterSpacing: '0.02rem',
    fontWeight: 900,
  },
  headerActions: {
    display: 'flex',
    gap: '0.65rem',
  },
  main: {
    width: 'min(1060px, 92%)',
    margin: '1.3rem auto 2rem',
    display: 'grid',
    gap: '1.15rem',
  },
  headlineWrap: {
    borderLeft: '4px solid #002147',
    paddingLeft: '0.95rem',
  },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(1.6rem, 3vw, 3rem)',
    lineHeight: 1.12,
    fontWeight: 900,
    color: '#001d4d',
  },
  pageSubtitle: {
    margin: '0.55rem 0 0',
    color: '#4d6287',
    fontSize: '1rem',
  },
  errorText: {
    margin: '0.6rem 0 0',
    color: '#b42318',
    fontWeight: 700,
  },
  groupSection: {
    display: 'grid',
    gap: '0.8rem',
  },
  groupTitle: {
    margin: 0,
    fontSize: '1.3rem',
    color: '#081f4d',
    fontWeight: 800,
  },
  candidateStack: {
    display: 'grid',
    gap: '0.7rem',
  },
  candidateCard: {
    background: '#fff',
    border: '1px solid #d9e1ef',
    borderRadius: '12px',
    padding: '0.9rem',
    boxShadow: '0 2px 10px rgba(5, 28, 65, 0.04)',
  },
  winnerCard: {
    borderColor: '#d4af37',
    boxShadow: '0 3px 14px rgba(212, 175, 55, 0.18)',
  },
  candidateMain: {
    display: 'flex',
    gap: '0.8rem',
    alignItems: 'center',
  },
  candidatePhoto: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #d5ddec',
  },
  photoFallback: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    border: '1px solid #d5ddec',
    display: 'grid',
    placeItems: 'center',
    background: '#e7edf8',
    fontWeight: 900,
    fontSize: '1.25rem',
  },
  candidateInfo: {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gap: '0.45rem',
  },
  candidateTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  candidateName: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 800,
    color: '#102856',
  },
  badge: {
    background: '#f8f1da',
    color: '#8b6a0c',
    border: '1px solid #e3cd8b',
    borderRadius: '999px',
    padding: '0.2rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 900,
    letterSpacing: '0.03rem',
  },
  metricsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  votesText: {
    color: '#314b79',
    fontWeight: 700,
  },
  percentText: {
    color: '#102856',
    fontWeight: 900,
  },
  progressTrack: {
    height: '11px',
    background: '#e4eaf3',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f1f4f8',
    alignContent: 'center',
    gap: '0.4rem',
  },
  spinner: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid #c5d0e2',
    borderTopColor: '#002147',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: '#4f638a',
    fontWeight: 700,
  },
  centerPage: {
    minHeight: '100vh',
    background: '#f1f4f8',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '0.6rem',
    textAlign: 'center',
    padding: '1rem',
  },
  centerTitle: {
    margin: 0,
    fontSize: '1.5rem',
    color: '#0b234f',
  },
  centerText: {
    margin: 0,
    color: '#53688f',
  },
  primaryBtn: {
    border: 0,
    borderRadius: '8px',
    background: '#002147',
    color: '#fff',
    height: '40px',
    padding: '0 0.9rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid #c6d1e3',
    borderRadius: '8px',
    background: '#eef3fb',
    color: '#0f2a59',
    height: '40px',
    padding: '0 0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
}
