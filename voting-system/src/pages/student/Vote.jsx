import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

function getElectionTitle(election) {
  return election?.title ?? election?.name ?? 'Student Election'
}

function getPositionTitle(position) {
  return (
    position?.title ??
    position?.name ??
    position?.position_name ??
    'Untitled Position'
  )
}

function getCandidateName(candidate) {
  return (
    candidate?.full_name ??
    candidate?.name ??
    [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ') ??
    'Unnamed Candidate'
  )
}

function getCandidateManifesto(candidate) {
  return (
    candidate?.manifesto ??
    candidate?.bio ??
    candidate?.summary ??
    'No manifesto provided.'
  )
}

function getCandidatePhoto(candidate) {
  return (
    candidate?.photo_url ??
    candidate?.image_url ??
    candidate?.avatar_url ??
    candidate?.profile_photo ??
    ''
  )
}

function isAlreadyVotedError(error) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
  return (
    text.includes('already voted') ||
    text.includes('duplicate') ||
    error?.code === '23505'
  )
}

function ConfirmationModal({
  open,
  positionTitle,
  candidateName,
  onCancel,
  onConfirm,
  busy,
}) {
  if (!open) return null

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalIconWrap}>✓</div>
        <h2 style={styles.modalTitle}>Confirm Your Vote</h2>

        <div style={styles.modalDesc}>
          Are you sure you want to cast your vote for{' '}
          <strong>{candidateName}</strong> as <strong>{positionTitle}</strong>?
          This action cannot be reversed.
        </div>

        <div style={styles.modalActions}>
          <button
            style={{ ...styles.modalPrimary, ...(busy ? styles.disabled : {}) }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Submitting...' : 'Confirm Vote'}
          </button>
          <button
            style={{ ...styles.modalSecondary, ...(busy ? styles.disabled : {}) }}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vote() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [selectedByPosition, setSelectedByPosition] = useState({})
  const [submittedByPosition, setSubmittedByPosition] = useState({})
  const [errorByPosition, setErrorByPosition] = useState({})
  const [submittingPositionId, setSubmittingPositionId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadVotingData = async () => {
      setLoading(true)
      setPageError('')

      const { data: activeElection, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('end_time', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!isMounted) return

      if (electionError) {
        setPageError('Failed to load active election.')
        setLoading(false)
        return
      }

      if (!activeElection) {
        setElection(null)
        setPositions([])
        setLoading(false)
        return
      }

      setElection(activeElection)

      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('election_id', activeElection.id)
        .order('id', { ascending: true })

      if (!isMounted) return

      if (positionsError) {
        setPageError('Failed to load positions.')
        setPositions([])
        setLoading(false)
        return
      }

      const safePositions = positionsData ?? []

      const candidateResults = await Promise.all(
        safePositions.map(async (position) => {
          const { data: candidatesData, error: candidatesError } = await supabase
            .from('candidates')
            .select('*')
            .eq('position_id', position.id)
            .order('id', { ascending: true })

          return {
            positionId: position.id,
            candidates: candidatesData ?? [],
            error: candidatesError,
          }
        })
      )

      if (!isMounted) return

      const candidatesByPosition = candidateResults.reduce((acc, item) => {
        acc[item.positionId] = item.candidates
        return acc
      }, {})

      const failedCandidateFetch = candidateResults.some((item) => item.error)
      if (failedCandidateFetch) {
        setPageError('Some candidates could not be loaded.')
      }

      const mergedPositions = safePositions.map((position) => ({
        ...position,
        candidates: candidatesByPosition[position.id] ?? [],
      }))

      setPositions(mergedPositions)
      setLoading(false)
    }

    loadVotingData()

    return () => {
      isMounted = false
    }
  }, [])

  const electionTitle = useMemo(() => getElectionTitle(election), [election])

  const handleSelectCandidate = (positionId, candidateId) => {
    setSelectedByPosition((prev) => ({
      ...prev,
      [positionId]: candidateId,
    }))
  }

  const openConfirm = (position, candidate) => {
    setErrorByPosition((prev) => ({
      ...prev,
      [position.id]: '',
    }))
    setConfirmTarget({ position, candidate })
  }

  const handleConfirmVote = async () => {
    if (!confirmTarget || !election?.id) return

    const positionId = confirmTarget.position.id
    const candidateId = confirmTarget.candidate.id

    setSubmittingPositionId(positionId)
    setErrorByPosition((prev) => ({
      ...prev,
      [positionId]: '',
    }))

    const { error } = await supabase.rpc('cast_vote_secure', {
      p_election_id: election.id,
      p_position_id: positionId,
      p_candidate_id: candidateId,
    })

    if (error) {
      if (isAlreadyVotedError(error)) {
        setSubmittedByPosition((prev) => ({
          ...prev,
          [positionId]: true,
        }))
        setErrorByPosition((prev) => ({
          ...prev,
          [positionId]: 'Vote already submitted for this position.',
        }))
      } else {
        setErrorByPosition((prev) => ({
          ...prev,
          [positionId]: error.message || 'Failed to submit vote.',
        }))
      }
      setSubmittingPositionId(null)
      setConfirmTarget(null)
      return
    }

    setSubmittedByPosition((prev) => ({
      ...prev,
      [positionId]: true,
    }))
    setSubmittingPositionId(null)
    setConfirmTarget(null)
  }

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading ballot...</p>
        <style>
          {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
        </style>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brandWrap}>
          <span style={styles.brandIcon}>🏛</span>
          <h1 style={styles.brand}>University Voting System</h1>
        </div>
        <button style={styles.navButton} onClick={() => navigate('/dashboard')}>
          Dashboard
        </button>
      </header>

      <main style={styles.main}>
        <h2 style={styles.electionTitle}>{electionTitle}</h2>
        <p style={styles.metaText}>
          {user?.email ? `Logged in as ${user.email}` : 'Secure voting session'}
        </p>
        {pageError ? <p style={styles.pageError}>{pageError}</p> : null}
        {!election ? <p style={styles.emptyText}>No Active Election</p> : null}

        {positions.map((position) => {
          const positionId = position.id
          const selectedId = selectedByPosition[positionId]
          const isSubmitted = Boolean(submittedByPosition[positionId])
          const isBusy = submittingPositionId === positionId
          const positionError = errorByPosition[positionId]
          const selectedCandidate =
            position.candidates.find((c) => c.id === selectedId) ?? null

          return (
            <section style={styles.positionCard} key={positionId}>
              <div style={styles.positionHeader}>
                <h3 style={styles.positionTitle}>{getPositionTitle(position)}</h3>
                {isSubmitted ? (
                  <span style={styles.submittedTag}>Vote Submitted</span>
                ) : null}
              </div>

              {position.candidates.length === 0 ? (
                <p style={styles.emptyText}>No candidates available.</p>
              ) : (
                <div style={styles.candidateGrid}>
                  {position.candidates.map((candidate) => {
                    const selected = selectedId === candidate.id
                    const photo = getCandidatePhoto(candidate)

                    return (
                      <label
                        key={candidate.id}
                        style={{
                          ...styles.candidateCard,
                          ...(selected ? styles.candidateCardSelected : {}),
                          ...(isSubmitted ? styles.disabled : {}),
                        }}
                      >
                        <input
                          type="radio"
                          name={`position-${positionId}`}
                          value={candidate.id}
                          checked={selected}
                          onChange={() =>
                            handleSelectCandidate(positionId, candidate.id)
                          }
                          disabled={isSubmitted || isBusy}
                          style={styles.radioInput}
                        />

                        <div style={styles.candidateTop}>
                          {photo ? (
                            <img
                              src={photo}
                              alt={getCandidateName(candidate)}
                              style={styles.avatar}
                            />
                          ) : (
                            <div style={styles.avatarFallback}>
                              {getCandidateName(candidate).charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <p style={styles.candidateName}>
                              {getCandidateName(candidate)}
                            </p>
                          </div>
                        </div>

                        <p style={styles.manifesto}>{getCandidateManifesto(candidate)}</p>
                      </label>
                    )
                  })}
                </div>
              )}

              {positionError ? <p style={styles.positionError}>{positionError}</p> : null}

              <div style={styles.actions}>
                <button
                  style={{
                    ...styles.voteButton,
                    ...((!selectedCandidate || isSubmitted || isBusy)
                      ? styles.disabled
                      : {}),
                  }}
                  disabled={!selectedCandidate || isSubmitted || isBusy}
                  onClick={() => openConfirm(position, selectedCandidate)}
                >
                  {isBusy ? 'Submitting Vote...' : 'Cast Vote'}
                </button>
              </div>
            </section>
          )
        })}
      </main>

      <ConfirmationModal
        open={Boolean(confirmTarget)}
        positionTitle={confirmTarget ? getPositionTitle(confirmTarget.position) : ''}
        candidateName={confirmTarget ? getCandidateName(confirmTarget.candidate) : ''}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmVote}
        busy={Boolean(submittingPositionId)}
      />

      <footer style={styles.footer}>
        © 2024 University Student Elections Commission. All rights reserved.
      </footer>

      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    color: '#0d234e',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '72px',
    background: '#fff',
    borderBottom: '1px solid #d8dfec',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  brandIcon: {
    fontSize: '1.3rem',
  },
  brand: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.02rem',
  },
  navButton: {
    border: '1px solid #b7c5de',
    background: '#fff',
    borderRadius: '8px',
    color: '#0d234e',
    padding: '0.45rem 0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  main: {
    width: 'min(1100px, 92%)',
    margin: '1.4rem auto',
    display: 'grid',
    gap: '1rem',
    flex: 1,
  },
  electionTitle: {
    margin: 0,
    fontSize: 'clamp(1.35rem, 2.5vw, 2.1rem)',
    fontWeight: 800,
    color: '#0b224f',
  },
  metaText: {
    margin: '-0.5rem 0 0',
    color: '#4f648d',
    fontWeight: 600,
  },
  pageError: {
    margin: 0,
    color: '#b42318',
    fontWeight: 700,
  },
  emptyText: {
    margin: '0.5rem 0',
    color: '#4f648d',
    fontWeight: 600,
  },
  positionCard: {
    background: '#fff',
    border: '1px solid #d8dfec',
    borderRadius: '12px',
    padding: '1rem',
    boxShadow: '0 4px 16px rgba(8, 24, 56, 0.04)',
  },
  positionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.8rem',
    marginBottom: '0.85rem',
  },
  positionTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 800,
    color: '#0b224f',
  },
  submittedTag: {
    background: '#dff5eb',
    color: '#067647',
    borderRadius: '999px',
    padding: '0.28rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.02rem',
  },
  candidateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '0.8rem',
  },
  candidateCard: {
    border: '1px solid #d4ddeb',
    borderRadius: '10px',
    padding: '0.8rem',
    display: 'grid',
    gap: '0.6rem',
    cursor: 'pointer',
    background: '#fff',
  },
  candidateCardSelected: {
    borderColor: '#002147',
    boxShadow: '0 0 0 1px #002147',
    background: '#f3f7ff',
  },
  candidateTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  radioInput: {
    margin: 0,
    width: '1rem',
    height: '1rem',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid #d4ddeb',
  },
  avatarFallback: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: '#e6ecf8',
    color: '#0d234e',
    fontWeight: 800,
    border: '1px solid #d4ddeb',
  },
  candidateName: {
    margin: 0,
    fontWeight: 800,
    color: '#0d234e',
  },
  manifesto: {
    margin: 0,
    color: '#455b83',
    lineHeight: 1.4,
    fontSize: '0.95rem',
  },
  positionError: {
    margin: '0.65rem 0 0',
    color: '#b42318',
    fontWeight: 600,
  },
  actions: {
    marginTop: '0.85rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  voteButton: {
    border: 0,
    borderRadius: '8px',
    background: '#002147',
    color: '#fff',
    height: '42px',
    padding: '0 1rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 33, 71, 0.58)',
    backdropFilter: 'blur(4px)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 40,
    padding: '1rem',
  },
  modalCard: {
    width: 'min(480px, 100%)',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #dbe3f0',
    padding: '1.5rem',
    boxShadow: '0 22px 44px rgba(7, 28, 62, 0.24)',
  },
  modalIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    display: 'grid',
    placeItems: 'center',
    background: '#edf2fb',
    color: '#002147',
    fontWeight: 900,
    fontSize: '1.2rem',
    margin: '0 auto 1rem',
  },
  modalTitle: {
    textAlign: 'center',
    margin: '0 0 0.8rem',
    color: '#0b224f',
    fontSize: '2rem',
    fontWeight: 900,
  },
  modalDesc: {
    margin: '0 auto 1rem',
    borderLeft: '4px solid #002147',
    background: '#f3f6fb',
    borderRadius: '8px',
    padding: '0.9rem',
    lineHeight: 1.5,
    color: '#263a5f',
  },
  modalActions: {
    display: 'grid',
    gap: '0.6rem',
  },
  modalPrimary: {
    border: 0,
    borderRadius: '8px',
    background: '#002147',
    color: '#fff',
    height: '48px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  modalSecondary: {
    border: '1px solid #d1d9e8',
    borderRadius: '8px',
    background: '#f1f4f9',
    color: '#263a5f',
    height: '48px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  footer: {
    borderTop: '1px solid #d8dfec',
    background: '#fff',
    textAlign: 'center',
    color: '#58709a',
    padding: '0.8rem',
    fontSize: '0.8rem',
  },
  loadingWrap: {
    minHeight: '100vh',
    background: '#f5f7fb',
    display: 'grid',
    placeItems: 'center',
    gap: '0.3rem',
    alignContent: 'center',
  },
  spinner: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid #c1cde2',
    borderTopColor: '#002147',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: '#486089',
    fontWeight: 700,
  },
  disabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
}
