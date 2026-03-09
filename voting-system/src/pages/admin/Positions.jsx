import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

const EMPTY_FORM = { title: '', description: '' }

function getPositionTitle(position) {
  return position?.title ?? position?.name ?? position?.position_name ?? '--'
}

function getPositionDescription(position) {
  return position?.description ?? position?.details ?? '--'
}

function electionLabel(election) {
  return election?.title ?? election?.name ?? `Election #${election?.id ?? ''}`
}

function hasElectionStarted(election) {
  if (!election) return false
  if (election.is_active) return true
  if (!election.start_time) return false
  return Date.now() >= new Date(election.start_time).getTime()
}

export default function Positions() {
  const navigate = useNavigate()

  const [elections, setElections] = useState([])
  const [selectedElectionId, setSelectedElectionId] = useState('')
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState({ id: null, type: '' })

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const selectedElection = useMemo(
    () => elections.find((e) => String(e.id) === String(selectedElectionId)) ?? null,
    [elections, selectedElectionId]
  )
  const electionStarted = hasElectionStarted(selectedElection)

  const fetchElections = async () => {
    const { data, error: fetchError } = await supabase
      .from('elections')
      .select('id, title, name, start_time, is_active')
      .order('start_time', { ascending: false })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load elections.')
      setElections([])
      setSelectedElectionId('')
      return
    }

    const rows = data ?? []
    setElections(rows)
    if (!selectedElectionId && rows.length > 0) {
      setSelectedElectionId(rows[0].id)
    }
  }

  const fetchPositionsForElection = async (electionId) => {
    if (!electionId) {
      setPositions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('positions')
      .select('*')
      .eq('election_id', electionId)
      .order('id', { ascending: true })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load positions.')
      setPositions([])
    } else {
      setPositions(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      await fetchElections()
      if (mounted) setLoading(false)
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    fetchPositionsForElection(selectedElectionId)
  }, [selectedElectionId])

  const openCreateModal = () => {
    if (!selectedElectionId) {
      setError('Select an election first.')
      return
    }
    if (electionStarted) {
      setError('Position editing is disabled after the election starts.')
      return
    }

    setError('')
    setCreateForm(EMPTY_FORM)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    if (creating) return
    setIsCreateModalOpen(false)
    setCreateForm(EMPTY_FORM)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')

    if (!createForm.title.trim()) {
      setError('Position title is required.')
      return
    }

    if (!selectedElectionId) {
      setError('Select an election first.')
      return
    }

    if (electionStarted) {
      setError('Position editing is disabled after the election starts.')
      return
    }

    setCreating(true)

    const { error: insertError } = await supabase.from('positions').insert({
      election_id: selectedElectionId,
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
    })

    if (insertError) {
      setError(insertError.message || 'Failed to create position.')
      setCreating(false)
      return
    }

    setCreating(false)
    setIsCreateModalOpen(false)
    setCreateForm(EMPTY_FORM)
    await fetchPositionsForElection(selectedElectionId)
  }

  const handleEdit = async (position) => {
    if (electionStarted) {
      setError('Position editing is disabled after the election starts.')
      return
    }

    const title = window.prompt('Position title', getPositionTitle(position))
    if (title == null) return

    const description = window.prompt(
      'Position description',
      getPositionDescription(position) === '--' ? '' : getPositionDescription(position)
    )
    if (description == null) return

    setBusyAction({ id: position.id, type: 'edit' })
    setError('')

    const { error: updateError } = await supabase
      .from('positions')
      .update({
        title: title.trim(),
        description: description.trim() || null,
      })
      .eq('id', position.id)

    if (updateError) {
      setError(updateError.message || 'Failed to update position.')
    }

    setBusyAction({ id: null, type: '' })
    await fetchPositionsForElection(selectedElectionId)
  }

  const handleDelete = async (position) => {
    if (electionStarted) {
      setError('Position editing is disabled after the election starts.')
      return
    }

    setBusyAction({ id: position.id, type: 'delete' })
    setError('')

    const { error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('id', position.id)

    if (deleteError) {
      setError(deleteError.message || 'Failed to delete position.')
    }

    setBusyAction({ id: null, type: '' })
    await fetchPositionsForElection(selectedElectionId)
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Positions</h1>
          <p style={styles.subtitle}>Manage positions for the selected election.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={() => navigate('/admin')}>
            Back to Dashboard
          </button>
          <button
            style={{ ...styles.primaryButton, ...(electionStarted ? styles.disabled : {}) }}
            onClick={openCreateModal}
            disabled={electionStarted}
          >
            Create Position
          </button>
        </div>
      </header>

      <section style={styles.filterRow}>
        <label style={styles.label} htmlFor="electionSelect">
          Select Election
        </label>
        <select
          id="electionSelect"
          style={styles.select}
          value={selectedElectionId}
          onChange={(event) => setSelectedElectionId(event.target.value)}
        >
          {elections.length === 0 ? <option value="">No elections available</option> : null}
          {elections.map((election) => (
            <option key={election.id} value={election.id}>
              {electionLabel(election)}
            </option>
          ))}
        </select>
        {electionStarted ? (
          <p style={styles.notice}>Editing disabled: selected election already started.</p>
        ) : null}
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}

      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading positions...</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Position Title</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td style={styles.emptyCell} colSpan={3}>
                    No positions found for this election.
                  </td>
                </tr>
              ) : (
                positions.map((position) => (
                  <tr key={position.id}>
                    <td style={styles.td}>{getPositionTitle(position)}</td>
                    <td style={styles.td}>{getPositionDescription(position)}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          style={{
                            ...styles.actionButton,
                            ...(electionStarted ? styles.disabled : {}),
                          }}
                          onClick={() => handleEdit(position)}
                          disabled={
                            electionStarted ||
                            (busyAction.id === position.id && busyAction.type === 'edit')
                          }
                        >
                          {busyAction.id === position.id && busyAction.type === 'edit'
                            ? 'Editing...'
                            : 'Edit'}
                        </button>
                        <button
                          style={styles.dangerButton}
                          onClick={() => handleDelete(position)}
                          disabled={
                            electionStarted ||
                            busyAction.id === position.id && busyAction.type === 'delete'
                          }
                        >
                          {busyAction.id === position.id && busyAction.type === 'delete'
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isCreateModalOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Create Position</h2>
            <form style={styles.modalForm} onSubmit={handleCreate}>
              <label style={styles.label} htmlFor="positionTitle">
                Position Title
              </label>
              <input
                id="positionTitle"
                style={styles.input}
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                }
                disabled={creating}
              />

              <label style={styles.label} htmlFor="positionDescription">
                Description
              </label>
              <textarea
                id="positionDescription"
                style={styles.textarea}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                disabled={creating}
              />

              <div style={styles.modalActions}>
                <button type="submit" style={styles.primaryButton} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Position'}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeCreateModal}
                  disabled={creating}
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
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  filterRow: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '0.75rem',
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
    fontSize: '0.9rem',
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
  tableWrap: {
    overflowX: 'auto',
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
  },
  table: {
    width: '100%',
    minWidth: '760px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontWeight: 700,
    padding: '0.65rem',
    borderBottom: '1px solid #d6dfed',
    color: '#2d4671',
    background: '#edf3fb',
  },
  td: {
    padding: '0.65rem',
    borderBottom: '1px solid #e0e7f3',
    verticalAlign: 'top',
  },
  emptyCell: {
    padding: '1rem',
    textAlign: 'center',
    color: '#5a7198',
  },
  actions: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
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
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 28, 64, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  modal: {
    width: 'min(460px, 100%)',
    background: '#fff',
    border: '1px solid #d6dfed',
    borderRadius: '12px',
    padding: '1rem',
    boxShadow: '0 16px 36px rgba(8, 28, 64, 0.22)',
  },
  modalTitle: {
    margin: '0 0 0.5rem',
    fontSize: '1.25rem',
    color: '#0b234e',
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
  modalActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.4rem',
  },
}
