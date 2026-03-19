import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

function getElectionTitle(e) { return e?.title ?? e?.name ?? 'Student Election' }
function getPositionTitle(p) { return p?.title ?? p?.name ?? p?.position_name ?? 'Untitled Position' }
function getCandidateName(c) {
  return c?.full_name ?? c?.name ??
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') ?? 'Unnamed'
}
function getCandidateManifesto(c) {
  return c?.manifesto ?? c?.bio ?? c?.summary ?? 'No manifesto provided.'
}
function getCandidatePhoto(c) {
  return c?.photo_url ?? c?.image_url ?? c?.avatar_url ?? c?.profile_photo ?? ''
}
function isAlreadyVotedError(error) {
  const t = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
  return t.includes('already voted') || t.includes('duplicate') || error?.code === '23505'
}

function ConfirmModal({ open, positionTitle, candidateName, onCancel, onConfirm, busy }) {
  if (!open) return null
  return (
    <div style={modal.overlay}>
      <div style={modal.card}>
        <div style={modal.iconWrap}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={modal.title}>Confirm Your Vote</h2>
        <div style={modal.desc}>
          <p style={modal.descText}>
            You are about to cast your vote for:
          </p>
          <div style={modal.voteInfo}>
            <span style={modal.voteLabel}>Candidate</span>
            <span style={modal.voteName}>{candidateName}</span>
            <span style={modal.voteLabel}>Position</span>
            <span style={modal.votePos}>{positionTitle}</span>
          </div>
          <p style={modal.warningText}>⚠️ This action is permanent and cannot be undone.</p>
        </div>
        <div style={modal.actions}>
          <button
            style={{ ...modal.cancelBtn, ...(busy ? modal.disabledBtn : {}) }}
            disabled={busy} onClick={onCancel}
          >Cancel</button>
          <button
            style={{ ...modal.confirmBtn, ...(busy ? modal.disabledBtn : {}) }}
            disabled={busy} onClick={onConfirm}
          >
            {busy ? (
              <span style={modal.loadingRow}>
                <span style={modal.spinner} />Submitting...
              </span>
            ) : '✓ Confirm Vote'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vote() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const mountedRef = useRef(true)
  const toastTimerRef = useRef(null)   // BUG FIX #9/#10 — store timer to cancel on unmount

  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [selectedByPosition, setSelectedByPosition] = useState({})
  const [submittedByPosition, setSubmittedByPosition] = useState({})
  const [errorByPosition, setErrorByPosition] = useState({})
  const [submittingPositionId, setSubmittingPositionId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [toast, setToast] = useState(null)

  // BUG FIX #9/#10 — clean up toast timer on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToast(null)
    }, 3500)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: activeElection, error: eErr } = await supabase
        .from('elections').select('*').eq('is_active', true)
        .order('end_time', { ascending: true }).limit(1).maybeSingle()

      if (!mountedRef.current) return
      if (eErr) { setPageError('Failed to load active election.'); setLoading(false); return }
      if (!activeElection) { setElection(null); setPositions([]); setLoading(false); return }
      setElection(activeElection)

      const { data: positionsData, error: pErr } = await supabase
        .from('positions').select('*').eq('election_id', activeElection.id)
        .order('id', { ascending: true })

      if (!mountedRef.current) return
      if (pErr) { setPageError('Failed to load positions.'); setLoading(false); return }

      const safe = positionsData ?? []

      // BUG FIX #11 — check error on each candidate fetch
      const results = await Promise.all(safe.map(async (pos) => {
        const { data, error: cErr } = await supabase.from('candidates').select('*')
          .eq('position_id', pos.id).order('id', { ascending: true })
        if (cErr) console.warn(`Failed to load candidates for position ${pos.id}:`, cErr.message)
        return { positionId: pos.id, candidates: data ?? [] }
      }))

      if (!mountedRef.current) return

      const byPos = results.reduce((acc, r) => { acc[r.positionId] = r.candidates; return acc }, {})
      setPositions(safe.map(p => ({ ...p, candidates: byPos[p.id] ?? [] })))

      // BUG FIX #13 — pre-populate submitted positions from DB so revisits show correct state
      if (user?.id && safe.length > 0) {
        // Try voter_id first, fall back to user_id
        let rows = null
        const { data: v1, error: ve1 } = await supabase
          .from('votes')
          .select('position_id')
          .eq('election_id', activeElection.id)
          .eq('voter_id', user.id)

        if (ve1) {
          const { data: v2 } = await supabase
            .from('votes')
            .select('position_id')
            .eq('election_id', activeElection.id)
            .eq('user_id', user.id)
          rows = v2
        } else {
          rows = v1
        }

        if (!mountedRef.current) return

        if (rows && rows.length > 0) {
          const alreadyVoted = rows.reduce((acc, row) => {
            if (row.position_id) acc[row.position_id] = true
            return acc
          }, {})
          setSubmittedByPosition(alreadyVoted)
        }
      }

      if (mountedRef.current) setLoading(false)
    }
    load()
  }, [user?.id])

  const electionTitle = useMemo(() => getElectionTitle(election), [election])
  const submittedCount = Object.values(submittedByPosition).filter(Boolean).length
  const totalPositions = positions.length
  const progressPct = totalPositions > 0 ? Math.round((submittedCount / totalPositions) * 100) : 0

  const handleSelectCandidate = (positionId, candidateId) => {
    if (submittedByPosition[positionId]) return
    setSelectedByPosition(prev => ({ ...prev, [positionId]: candidateId }))
  }

  const openConfirm = (position, candidate) => {
    setErrorByPosition(prev => ({ ...prev, [position.id]: '' }))
    setConfirmTarget({ position, candidate })
  }

  const handleConfirmVote = async () => {
    if (!confirmTarget || !election?.id) return
    const { position, candidate } = confirmTarget
    const positionId = position.id

    setSubmittingPositionId(positionId)
    setErrorByPosition(prev => ({ ...prev, [positionId]: '' }))

    const { error } = await supabase.rpc('cast_vote_secure', {
      p_election_id: election.id,
      p_position_id: positionId,
      p_candidate_id: candidate.id,
    })

    if (error) {
      if (isAlreadyVotedError(error)) {
        setSubmittedByPosition(prev => ({ ...prev, [positionId]: true }))
        setErrorByPosition(prev => ({ ...prev, [positionId]: 'Vote already submitted for this position.' }))
        showToast('Vote already recorded for this position.', 'info')
      } else {
        setErrorByPosition(prev => ({ ...prev, [positionId]: error.message || 'Failed to submit vote.' }))
        showToast('Failed to submit vote. Please try again.', 'error')
      }
    } else {
      setSubmittedByPosition(prev => ({ ...prev, [positionId]: true }))
      showToast(`Vote cast for ${getCandidateName(candidate)} ✓`, 'success')
    }

    setSubmittingPositionId(null)
    setConfirmTarget(null)
  }

  if (loading) return (
    <div style={styles.loadingPage}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <div style={styles.loadingSpinner} />
      <p style={styles.loadingText}>Loading your ballot...</p>
    </div>
  )

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(110%)}}
        .candidate-card:hover { border-color: #1a56db !important; box-shadow: 0 2px 16px rgba(26,86,219,0.12) !important; }
        .vote-btn:hover:not(:disabled) { background: #1e429f !important; }
        .nav-back:hover { background: rgba(26,86,219,0.08) !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#1a56db',
        }}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✗ '}
          {toast.message}
        </div>
      )}

      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.navLeft}>
            <button className="nav-back" onClick={() => navigate('/dashboard')} style={styles.backBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              Dashboard
            </button>
          </div>
          <div style={styles.navCenter}>
            <span style={styles.navBrand}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#1a56db"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              UniVote
            </span>
          </div>
          <div style={styles.navRight}>
            <span style={styles.navEmail}>{user?.email?.split('@')[0]}</span>
          </div>
        </div>
      </nav>

      <main style={styles.main}>
        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>{electionTitle}</h1>
            <p style={styles.pageSub}>
              {user?.email ? `Voting as ${user.email.split('@st.ug.edu.gh')[0]}` : 'Secure voting session'}
            </p>
          </div>

          {totalPositions > 0 && (
            <div style={styles.progressWidget}>
              <div style={styles.progressTop}>
                <span style={styles.progressPct}>{progressPct}%</span>
                <span style={styles.progressDetail}>{submittedCount}/{totalPositions} submitted</span>
              </div>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {pageError && <div style={styles.pageError}>{pageError}</div>}
        {!election && <div style={styles.noElection}>🗳️ No active election found.</div>}

        {/* Position cards */}
        <div style={styles.positionsStack}>
          {positions.map((position, posIndex) => {
            const positionId = position.id
            const selectedId = selectedByPosition[positionId]
            const isSubmitted = Boolean(submittedByPosition[positionId])
            const isBusy = submittingPositionId === positionId
            const positionError = errorByPosition[positionId]
            const selectedCandidate = position.candidates.find(c => c.id === selectedId) ?? null

            return (
              <section key={positionId} style={{
                ...styles.positionCard,
                ...(isSubmitted ? styles.positionCardDone : {}),
                animationDelay: `${posIndex * 0.06}s`,
              }}>
                <div style={styles.positionHeader}>
                  <div style={styles.positionHeaderLeft}>
                    <span style={styles.positionIndex}>{String(posIndex + 1).padStart(2, '0')}</span>
                    <h2 style={styles.positionTitle}>{getPositionTitle(position)}</h2>
                  </div>
                  {isSubmitted && (
                    <span style={styles.submittedBadge}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Vote Submitted
                    </span>
                  )}
                </div>

                {position.candidates.length === 0 ? (
                  <div style={styles.noCandidates}>No candidates available for this position.</div>
                ) : (
                  <div style={styles.candidateGrid}>
                    {position.candidates.map(candidate => {
                      const selected = selectedId === candidate.id
                      const photo = getCandidatePhoto(candidate)
                      return (
                        <label
                          key={candidate.id}
                          className="candidate-card"
                          style={{
                            ...styles.candidateCard,
                            ...(selected ? styles.candidateCardSelected : {}),
                            ...(isSubmitted ? styles.candidateCardDisabled : {}),
                          }}
                          // BUG FIX #14 — removed onClick from label to prevent double-fire with onChange on input
                        >
                          <input
                            type="radio"
                            name={`pos-${positionId}`}
                            checked={selected}
                            onChange={() => {
                              if (!isSubmitted && !isBusy) handleSelectCandidate(positionId, candidate.id)
                            }}
                            disabled={isSubmitted || isBusy}
                            style={{ display: 'none' }}
                          />

                          {/* Selection indicator */}
                          <div style={{ ...styles.radioCircle, ...(selected ? styles.radioCircleSelected : {}) }}>
                            {selected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>

                          <div style={styles.candidateContent}>
                            {photo ? (
                              <img src={photo} alt={getCandidateName(candidate)} style={styles.candidatePhoto} />
                            ) : (
                              <div style={{ ...styles.candidateAvatar, ...(selected ? styles.candidateAvatarSelected : {}) }}>
                                {getCandidateName(candidate).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div style={styles.candidateInfo}>
                              <p style={styles.candidateName}>{getCandidateName(candidate)}</p>
                              <p style={styles.candidateManifesto}>{getCandidateManifesto(candidate)}</p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}

                {positionError && <p style={styles.posError}>{positionError}</p>}

                <div style={styles.positionFooter}>
                  {!isSubmitted && (
                    <button
                      className="vote-btn"
                      style={{
                        ...styles.voteBtn,
                        ...(!selectedCandidate || isBusy ? styles.voteBtnDisabled : {}),
                      }}
                      disabled={!selectedCandidate || isSubmitted || isBusy}
                      onClick={() => selectedCandidate && openConfirm(position, selectedCandidate)}
                    >
                      {isBusy ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={styles.smallSpinner} />Submitting...
                        </span>
                      ) : selectedCandidate ? `Vote for ${getCandidateName(selectedCandidate)}` : 'Select a candidate'}
                    </button>
                  )}
                  {isSubmitted && (
                    <div style={styles.submittedInfo}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Your vote has been recorded for this position
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {submittedCount === totalPositions && totalPositions > 0 && (
          <div style={styles.completionCard}>
            <div style={styles.completionIcon}>🎉</div>
            <h3 style={styles.completionTitle}>Ballot Complete!</h3>
            <p style={styles.completionText}>You have successfully voted in all {totalPositions} positions. Your votes are securely recorded.</p>
            <button onClick={() => navigate('/dashboard')} style={styles.completionBtn}>
              Return to Dashboard
            </button>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        © 2025 University of Ghana Elections Commission · All votes are encrypted and anonymous
      </footer>

      <ConfirmModal
        open={Boolean(confirmTarget)}
        positionTitle={confirmTarget ? getPositionTitle(confirmTarget.position) : ''}
        candidateName={confirmTarget ? getCandidateName(confirmTarget.candidate) : ''}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmVote}
        busy={Boolean(submittingPositionId)}
      />
    </div>
  )
}

const modal = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.65)',
    backdropFilter: 'blur(8px)',
    display: 'grid', placeItems: 'center',
    zIndex: 50, padding: '1rem',
  },
  card: {
    width: 'min(480px, 100%)',
    background: '#fff', borderRadius: '20px',
    padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
    animation: 'fadeUp 0.2s ease both',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  iconWrap: {
    width: '56px', height: '56px',
    background: 'rgba(26,86,219,0.1)',
    borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    margin: 0, fontSize: '1.5rem', fontWeight: '800',
    color: '#0f172a', letterSpacing: '-0.02em',
  },
  desc: { display: 'flex', flexDirection: 'column', gap: '12px' },
  descText: { margin: 0, color: '#6b7280', fontSize: '0.9rem' },
  voteInfo: {
    background: '#f8fafc', borderRadius: '12px', padding: '1rem',
    display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px',
    alignItems: 'center',
  },
  voteLabel: { color: '#9ca3af', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  voteName: { color: '#0f172a', fontSize: '1rem', fontWeight: '700' },
  votePos: { color: '#1a56db', fontSize: '0.9rem', fontWeight: '600' },
  warningText: {
    margin: 0, color: '#d97706', fontSize: '0.82rem', fontWeight: '600',
    background: '#fffbeb', borderRadius: '8px', padding: '8px 12px',
  },
  actions: { display: 'flex', gap: '10px' },
  cancelBtn: {
    flex: 1, height: '48px', background: '#f3f4f6',
    border: 'none', borderRadius: '12px',
    color: '#374151', fontFamily: "'Sora', sans-serif",
    fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
  },
  confirmBtn: {
    flex: 2, height: '48px',
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: '#fff', fontFamily: "'Sora', sans-serif",
    fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer',
  },
  disabledBtn: { opacity: 0.6, cursor: 'not-allowed' },
  loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner: {
    width: '14px', height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
}

const styles = {
  page: {
    minHeight: '100vh', background: '#f8fafc',
    fontFamily: "'Sora', sans-serif", color: '#0f172a',
  },
  loadingPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#f8fafc', fontFamily: "'Sora', sans-serif",
    gap: '1rem', flexDirection: 'column',
  },
  loadingSpinner: {
    width: '36px', height: '36px', border: '3px solid #e5e7eb',
    borderTopColor: '#1a56db', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { margin: 0, color: '#6b7280', fontWeight: '600' },
  toast: {
    position: 'fixed', bottom: '24px', right: '24px',
    zIndex: 100, color: '#fff', padding: '14px 20px',
    borderRadius: '12px', fontSize: '0.875rem', fontWeight: '600',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    animation: 'slideIn 0.3s ease',
    maxWidth: '360px',
  },
  nav: {
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    position: 'sticky', top: 0, zIndex: 10, height: '64px',
    display: 'flex', alignItems: 'center',
  },
  navInner: {
    width: 'min(1200px, 94%)', margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navLeft: { flex: 1 },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '7px 12px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.15s',
  },
  navCenter: { display: 'flex', justifyContent: 'center', flex: 1 },
  navBrand: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '1.1rem', fontWeight: '800', color: '#0f172a',
  },
  navRight: { flex: 1, display: 'flex', justifyContent: 'flex-end' },
  navEmail: { color: '#6b7280', fontSize: '0.82rem', fontWeight: '500' },
  main: {
    width: 'min(900px, 94%)', margin: '0 auto',
    padding: '2rem 0 3rem',
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem',
  },
  pageTitle: {
    margin: '0 0 0.25rem', fontSize: 'clamp(1.35rem, 3vw, 1.75rem)',
    fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em',
  },
  pageSub: { margin: 0, color: '#6b7280', fontSize: '0.875rem' },
  progressWidget: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '14px', padding: '14px 18px', minWidth: '200px',
  },
  progressTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '8px',
  },
  progressPct: { fontSize: '1.1rem', fontWeight: '800', color: '#1a56db' },
  progressDetail: { color: '#6b7280', fontSize: '0.78rem', fontWeight: '600' },
  progressTrack: {
    height: '6px', background: '#f3f4f6',
    borderRadius: '999px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1a56db, #6366f1)',
    borderRadius: '999px', transition: 'width 0.5s ease',
  },
  pageError: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '12px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  noElection: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', padding: '2rem',
    textAlign: 'center', color: '#6b7280', fontSize: '0.95rem',
  },
  positionsStack: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  positionCard: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '20px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    animation: 'fadeUp 0.4s ease both',
  },
  positionCardDone: { borderColor: '#bbf7d0', background: '#f0fdf4' },
  positionHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '10px',
  },
  positionHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  positionIndex: {
    width: '36px', height: '36px',
    background: '#f3f4f6', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', fontWeight: '800', color: '#6b7280',
    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
  },
  positionTitle: {
    margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a',
  },
  submittedBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: '#dcfce7', color: '#15803d',
    borderRadius: '999px', padding: '5px 12px',
    fontSize: '0.78rem', fontWeight: '700',
  },
  noCandidates: {
    color: '#6b7280', fontSize: '0.875rem',
    textAlign: 'center', padding: '1rem',
  },
  candidateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '10px',
  },
  candidateCard: {
    border: '2px solid #e5e7eb', borderRadius: '14px',
    padding: '1rem', cursor: 'pointer',
    background: '#fff', position: 'relative',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
    display: 'flex', flexDirection: 'column', gap: '0',
  },
  candidateCardSelected: {
    borderColor: '#1a56db', background: '#eff6ff',
    boxShadow: '0 0 0 3px rgba(26,86,219,0.1)',
  },
  candidateCardDisabled: { opacity: 0.7, cursor: 'default' },
  radioCircle: {
    position: 'absolute', top: '12px', right: '12px',
    width: '20px', height: '20px',
    border: '2px solid #d1d5db', borderRadius: '50%',
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s, background 0.15s',
    flexShrink: 0,
  },
  radioCircleSelected: {
    border: '2px solid #1a56db', background: '#1a56db',
  },
  candidateContent: {
    display: 'flex', gap: '12px', alignItems: 'flex-start',
    paddingRight: '28px',
  },
  candidatePhoto: {
    width: '52px', height: '52px', borderRadius: '12px',
    objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0,
  },
  candidateAvatar: {
    width: '52px', height: '52px', borderRadius: '12px',
    background: '#f3f4f6', border: '1px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem', fontWeight: '800', color: '#374151',
    flexShrink: 0, transition: 'background 0.15s',
  },
  candidateAvatarSelected: { background: '#dbeafe', color: '#1a56db' },
  candidateInfo: { flex: 1, minWidth: 0 },
  candidateName: {
    margin: '0 0 4px', fontSize: '0.95rem', fontWeight: '700', color: '#0f172a',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  candidateManifesto: {
    margin: 0, fontSize: '0.8rem', color: '#6b7280',
    lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  posError: {
    margin: 0, color: '#dc2626',
    fontSize: '0.82rem', fontWeight: '600',
    background: '#fef2f2', borderRadius: '8px', padding: '8px 12px',
  },
  positionFooter: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
  },
  voteBtn: {
    background: 'linear-gradient(135deg, #1a56db, #6366f1)',
    border: 'none', borderRadius: '10px',
    color: '#fff', padding: '11px 22px',
    fontSize: '0.875rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.15s',
  },
  voteBtnDisabled: {
    background: '#f3f4f6', color: '#9ca3af',
    cursor: 'not-allowed', boxShadow: 'none',
  },
  submittedInfo: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: '#059669', fontSize: '0.82rem', fontWeight: '600',
  },
  smallSpinner: {
    width: '12px', height: '12px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
  completionCard: {
    background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
    borderRadius: '20px', padding: '2.5rem',
    textAlign: 'center', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  },
  completionIcon: { fontSize: '2.5rem' },
  completionTitle: {
    margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em',
  },
  completionText: {
    margin: 0, color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '400px',
  },
  completionBtn: {
    background: '#fff', border: 'none', borderRadius: '12px',
    color: '#0f172a', padding: '12px 24px',
    fontSize: '0.9rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
  },
  footer: {
    borderTop: '1px solid #e5e7eb', background: '#fff',
    textAlign: 'center', color: '#9ca3af',
    padding: '1rem', fontSize: '0.75rem', fontWeight: '500',
  },
}