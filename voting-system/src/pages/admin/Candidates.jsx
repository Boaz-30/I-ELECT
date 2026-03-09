import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

const STORAGE_BUCKET =
  import.meta.env.VITE_SUPABASE_CANDIDATE_BUCKET || 'candidate-photos'

const EMPTY_FORM = {
  name: '',
  manifesto: '',
  photoFile: null,
  photoUrl: '',
}

function getElectionLabel(election) {
  return election?.title ?? election?.name ?? `Election #${election?.id ?? ''}`
}

function getPositionLabel(position) {
  return (
    position?.title ?? position?.name ?? position?.position_name ?? `Position #${position?.id ?? ''}`
  )
}

function getCandidateName(candidate) {
  return (
    candidate?.name ??
    candidate?.full_name ??
    [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ') ??
    'Unnamed Candidate'
  )
}

function getCandidateManifesto(candidate) {
  return candidate?.manifesto ?? candidate?.bio ?? candidate?.summary ?? ''
}

function getCandidatePhoto(candidate) {
  return candidate?.photo_url ?? candidate?.image_url ?? candidate?.avatar_url ?? ''
}

function hasElectionStarted(election) {
  if (!election) return false
  if (election.is_active) return true
  if (!election.start_time) return false
  return Date.now() >= new Date(election.start_time).getTime()
}

function truncate(text, max = 140) {
  if (!text) return 'No manifesto provided.'
  if (text.length <= max) return text
  return `${text.slice(0, max).trim()}...`
}

async function uploadPhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `candidates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? ''
}

export default function Candidates() {
  const navigate = useNavigate()

  const [elections, setElections] = useState([])
  const [positions, setPositions] = useState([])
  const [candidates, setCandidates] = useState([])

  const [selectedElectionId, setSelectedElectionId] = useState('')
  const [selectedPositionId, setSelectedPositionId] = useState('')

  const [loadingElections, setLoadingElections] = useState(true)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingCandidateId, setDeletingCandidateId] = useState(null)

  const selectedElection = useMemo(
    () => elections.find((item) => String(item.id) === String(selectedElectionId)) ?? null,
    [elections, selectedElectionId]
  )
  const selectedPosition = useMemo(
    () => positions.find((item) => String(item.id) === String(selectedPositionId)) ?? null,
    [positions, selectedPositionId]
  )
  const electionStarted = hasElectionStarted(selectedElection)

  const fetchElections = async () => {
    setLoadingElections(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('elections')
      .select('id, title, name, start_time, is_active')
      .order('start_time', { ascending: false })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load elections.')
      setElections([])
      setSelectedElectionId('')
      setLoadingElections(false)
      return
    }

    const rows = data ?? []
    setElections(rows)
    if (!selectedElectionId && rows.length > 0) {
      setSelectedElectionId(rows[0].id)
      await fetchPositions(rows[0].id)
    } else if (selectedElectionId) {
      await fetchPositions(selectedElectionId)
    }

    setLoadingElections(false)
  }

  const fetchPositions = async (electionId) => {
    if (!electionId) {
      setPositions([])
      setSelectedPositionId('')
      setCandidates([])
      return
    }

    setLoadingPositions(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('positions')
      .select('*')
      .eq('election_id', electionId)
      .order('id', { ascending: true })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load positions.')
      setPositions([])
      setSelectedPositionId('')
      setCandidates([])
      setLoadingPositions(false)
      return
    }

    const rows = data ?? []
    setPositions(rows)

    const nextPositionId =
      rows.find((item) => String(item.id) === String(selectedPositionId))?.id ??
      rows[0]?.id ??
      ''

    setSelectedPositionId(nextPositionId)
    if (nextPositionId) {
      await fetchCandidates(nextPositionId)
    } else {
      setCandidates([])
    }

    setLoadingPositions(false)
  }

  const fetchCandidates = async (positionId) => {
    if (!positionId) {
      setCandidates([])
      return
    }

    setLoadingCandidates(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .eq('position_id', positionId)
      .order('id', { ascending: true })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load candidates.')
      setCandidates([])
    } else {
      setCandidates(data ?? [])
    }

    setLoadingCandidates(false)
  }

  useEffect(() => {
    fetchElections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleElectionChange = async (event) => {
    const electionId = event.target.value
    setSelectedElectionId(electionId)
    await fetchPositions(electionId)
  }

  const handlePositionChange = async (event) => {
    const positionId = event.target.value
    setSelectedPositionId(positionId)
    await fetchCandidates(positionId)
  }

  const openCreateModal = () => {
    if (!selectedPosition) {
      setError('Select a position first.')
      return
    }

    setModalMode('create')
    setEditingCandidate(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (candidate) => {
    setModalMode('edit')
    setEditingCandidate(candidate)
    setForm({
      name: getCandidateName(candidate),
      manifesto: getCandidateManifesto(candidate),
      photoFile: null,
      photoUrl: getCandidatePhoto(candidate),
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingCandidate(null)
  }

  const handleSaveCandidate = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedPositionId) {
      setError('Select a position first.')
      return
    }

    if (!form.name.trim()) {
      setError('Candidate name is required.')
      return
    }

    setSaving(true)

    let photoUrl = form.photoUrl || ''
    try {
      if (form.photoFile) {
        photoUrl = await uploadPhoto(form.photoFile)
      }
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload candidate photo.')
      setSaving(false)
      return
    }

    const payload = {
      position_id: selectedPositionId,
      name: form.name.trim(),
      manifesto: form.manifesto.trim() || null,
      photo_url: photoUrl || null,
    }

    let writeError = null
    if (modalMode === 'edit' && editingCandidate) {
      const { error: updateError } = await supabase
        .from('candidates')
        .update(payload)
        .eq('id', editingCandidate.id)
      writeError = updateError
    } else {
      const { error: insertError } = await supabase.from('candidates').insert(payload)
      writeError = insertError
    }

    if (writeError) {
      setError(writeError.message || 'Failed to save candidate.')
      setSaving(false)
      return
    }

    setSaving(false)
    closeModal()
    await fetchCandidates(selectedPositionId)
  }

  const handleDeleteCandidate = async (candidate) => {
    if (electionStarted) {
      setError('Delete is only allowed before election starts.')
      return
    }

    const ok = window.confirm(`Delete candidate "${getCandidateName(candidate)}"?`)
    if (!ok) return

    setDeletingCandidateId(candidate.id)
    setError('')

    const { error: deleteError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidate.id)

    if (deleteError) {
      setError(deleteError.message || 'Failed to delete candidate.')
    }

    setDeletingCandidateId(null)
    await fetchCandidates(selectedPositionId)
  }

  const isLoading = loadingElections || loadingPositions || loadingCandidates

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Candidates</h1>
          <p style={styles.subtitle}>
            Manage candidate profiles for a selected position.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={() => navigate('/admin')}>
            Back to Dashboard
          </button>
          <button style={styles.primaryButton} onClick={openCreateModal}>
            Create Candidate
          </button>
        </div>
      </header>

      <section style={styles.filters}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="electionSelect">
            Election
          </label>
          <select
            id="electionSelect"
            style={styles.select}
            value={selectedElectionId}
            onChange={handleElectionChange}
          >
            {elections.length === 0 ? <option value="">No elections available</option> : null}
            {elections.map((election) => (
              <option key={election.id} value={election.id}>
                {getElectionLabel(election)}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="positionSelect">
            Position
          </label>
          <select
            id="positionSelect"
            style={styles.select}
            value={selectedPositionId}
            onChange={handlePositionChange}
          >
            {positions.length === 0 ? <option value="">No positions available</option> : null}
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {getPositionLabel(position)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {electionStarted ? (
        <p style={styles.notice}>Delete is disabled because the election has started.</p>
      ) : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {isLoading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading candidates...</p>
        </div>
      ) : (
        <section style={styles.grid}>
          {candidates.length === 0 ? (
            <div style={styles.empty}>No candidates found for this position.</div>
          ) : (
            candidates.map((candidate) => {
              const photo = getCandidatePhoto(candidate)

              return (
                <article key={candidate.id} style={styles.card}>
                  {photo ? (
                    <img src={photo} alt={getCandidateName(candidate)} style={styles.image} />
                  ) : (
                    <div style={styles.fallbackAvatar}>
                      {getCandidateName(candidate).charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={styles.cardBody}>
                    <p style={styles.name}>{getCandidateName(candidate)}</p>
                    <p style={styles.manifesto}>{truncate(getCandidateManifesto(candidate))}</p>
                  </div>

                  <div style={styles.cardActions}>
                    <button style={styles.actionButton} onClick={() => openEditModal(candidate)}>
                      Edit
                    </button>
                    <button
                      style={{
                        ...styles.dangerButton,
                        ...(electionStarted ? styles.disabled : {}),
                      }}
                      disabled={electionStarted || deletingCandidateId === candidate.id}
                      onClick={() => handleDeleteCandidate(candidate)}
                    >
                      {deletingCandidateId === candidate.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </section>
      )}

      {modalOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {modalMode === 'edit' ? 'Edit Candidate' : 'Create Candidate'}
            </h2>
            <p style={styles.modalSub}>Position: {getPositionLabel(selectedPosition)}</p>

            <form style={styles.modalForm} onSubmit={handleSaveCandidate}>
              <label style={styles.label} htmlFor="candidateName">
                Name
              </label>
              <input
                id="candidateName"
                style={styles.input}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={saving}
              />

              <label style={styles.label} htmlFor="candidateManifesto">
                Manifesto
              </label>
              <textarea
                id="candidateManifesto"
                style={styles.textarea}
                value={form.manifesto}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, manifesto: event.target.value }))
                }
                disabled={saving}
              />

              <label style={styles.label} htmlFor="candidatePhoto">
                Photo
              </label>
              <input
                id="candidatePhoto"
                type="file"
                accept="image/*"
                style={styles.inputFile}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    photoFile: event.target.files?.[0] ?? null,
                  }))
                }
                disabled={saving}
              />

              {form.photoUrl ? (
                <img src={form.photoUrl} alt="Candidate preview" style={styles.previewImage} />
              ) : null}

              <div style={styles.modalActions}>
                <button type="submit" style={styles.primaryButton} disabled={saving}>
                  {saving ? 'Saving...' : modalMode === 'edit' ? 'Update Candidate' : 'Create Candidate'}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
    gap: '0.85rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.8rem',
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
  filters: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '0.75rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '0.7rem',
  },
  field: {
    display: 'grid',
    gap: '0.35rem',
  },
  label: {
    fontWeight: 600,
    color: '#2d4671',
  },
  select: {
    height: '40px',
    border: '1px solid #c8d4e7',
    borderRadius: '8px',
    padding: '0 0.6rem',
    background: '#fff',
  },
  notice: {
    margin: 0,
    color: '#9a5d02',
    fontWeight: 600,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '0.8rem',
  },
  card: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'grid',
    gridTemplateColumns: '80px 1fr',
    gap: '0.7rem',
    alignItems: 'start',
  },
  image: {
    width: '80px',
    height: '80px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #d0d9e8',
  },
  fallbackAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '8px',
    border: '1px solid #d0d9e8',
    background: '#e6edf9',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 900,
    fontSize: '1.2rem',
    color: '#0b234e',
  },
  cardBody: {
    display: 'grid',
    gap: '0.35rem',
    minWidth: 0,
  },
  name: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#0f2a58',
  },
  manifesto: {
    margin: 0,
    color: '#51678f',
    lineHeight: 1.35,
  },
  cardActions: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '0.45rem',
    justifyContent: 'flex-end',
    marginTop: '0.15rem',
  },
  actionButton: {
    border: 0,
    background: '#08255d',
    color: '#fff',
    borderRadius: '6px',
    padding: '0.45rem 0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  dangerButton: {
    border: 0,
    background: '#b42318',
    color: '#fff',
    borderRadius: '6px',
    padding: '0.45rem 0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  empty: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '1rem',
    color: '#5a7198',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 28, 64, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    zIndex: 50,
  },
  modal: {
    width: 'min(520px, 100%)',
    background: '#fff',
    border: '1px solid #d6dfed',
    borderRadius: '12px',
    padding: '1rem',
    boxShadow: '0 16px 36px rgba(8, 28, 64, 0.22)',
  },
  modalTitle: {
    margin: '0 0 0.2rem',
    fontSize: '1.3rem',
    color: '#0b234e',
  },
  modalSub: {
    margin: '0 0 0.6rem',
    color: '#5a7198',
  },
  modalForm: {
    display: 'grid',
    gap: '0.45rem',
  },
  input: {
    height: '40px',
    border: '1px solid #c8d4e7',
    borderRadius: '8px',
    padding: '0 0.6rem',
    background: '#fff',
  },
  textarea: {
    minHeight: '96px',
    resize: 'vertical',
    border: '1px solid #c8d4e7',
    borderRadius: '8px',
    padding: '0.6rem',
    background: '#fff',
    fontFamily: 'inherit',
  },
  inputFile: {
    border: '1px solid #c8d4e7',
    borderRadius: '8px',
    background: '#fff',
    padding: '0.4rem',
  },
  previewImage: {
    width: '92px',
    height: '92px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #d0d9e8',
    marginTop: '0.25rem',
  },
  modalActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.45rem',
  },
}
