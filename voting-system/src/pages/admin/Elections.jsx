import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

const EMPTY_FORM = {
  title: '',
  startTime: '',
  endTime: '',
}

function toLocalDateTime(isoString) {
  if (!isoString) return ''

  const date = new Date(isoString)
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function toIso(localDateTime) {
  return new Date(localDateTime).toISOString()
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString()
}

function hasElectionStarted(election) {
  if (!election) return false
  if (election.is_active) return true
  if (!election.start_time) return false
  return Date.now() >= new Date(election.start_time).getTime()
}

export default function Elections() {
  const navigate = useNavigate()

  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editingElection, setEditingElection] = useState(null)
  const [actionState, setActionState] = useState({ id: null, type: '' })

  const fetchElections = async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('elections')
      .select('id, title, start_time, end_time, is_active, results_approved')
      .order('start_time', { ascending: false })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load elections.')
      setElections([])
    } else {
      setElections(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchElections()
  }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingElection(null)
    setSubmitting(false)
    setShowForm(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.title.trim() || !form.startTime || !form.endTime) {
      setError('Title, start time, and end time are required.')
      return
    }

    if (new Date(form.endTime).getTime() <= new Date(form.startTime).getTime()) {
      setError('End time must be after start time.')
      return
    }

    if (editingElection && hasElectionStarted(editingElection)) {
      setError('Edit is disabled after an election starts.')
      return
    }

    setSubmitting(true)

    const payload = {
      title: form.title.trim(),
      start_time: toIso(form.startTime),
      end_time: toIso(form.endTime),
    }

    let writeError = null

    if (editingElection) {
      const { error: updateError } = await supabase
        .from('elections')
        .update(payload)
        .eq('id', editingElection.id)
      writeError = updateError
    } else {
      const { error: insertError } = await supabase.from('elections').insert({
        ...payload,
        is_active: false,
        results_approved: false,
      })
      writeError = insertError
    }

    if (writeError) {
      setError(writeError.message || 'Failed to save election.')
      setSubmitting(false)
      return
    }

    resetForm()
    await fetchElections()
  }

  const runRowAction = async (electionId, type, action) => {
    setError('')
    setActionState({ id: electionId, type })

    const { error: actionError } = await action()

    if (actionError) {
      setError(actionError.message || 'Action failed.')
    }

    setActionState({ id: null, type: '' })
    await fetchElections()
  }

  const handleStart = async (election) => {
    await runRowAction(election.id, 'start', async () => {
      const { error: deactivateError } = await supabase
        .from('elections')
        .update({ is_active: false })
        .neq('id', election.id)

      if (deactivateError) return { error: deactivateError }

      return supabase
        .from('elections')
        .update({ is_active: true, results_approved: false })
        .eq('id', election.id)
    })
  }

  const handleEnd = async (election) => {
    await runRowAction(election.id, 'end', () =>
      supabase
        .from('elections')
        .update({ is_active: false, end_time: new Date().toISOString() })
        .eq('id', election.id)
    )
  }

  const handleApprove = async (election) => {
    await runRowAction(election.id, 'approve', () =>
      supabase
        .from('elections')
        .update({ results_approved: true, is_active: false })
        .eq('id', election.id)
    )
  }

  const handleEdit = (election) => {
    if (hasElectionStarted(election)) return

    setEditingElection(election)
    setForm({
      title: election.title ?? '',
      startTime: toLocalDateTime(election.start_time),
      endTime: toLocalDateTime(election.end_time),
    })
    setShowForm(true)
  }

  const handleDelete = async (election) => {
    if (hasElectionStarted(election)) {
      setError('Delete is disabled after an election starts.')
      return
    }

    await runRowAction(election.id, 'delete', () =>
      supabase.from('elections').delete().eq('id', election.id)
    )
  }

  const isActionBusy = (id, type) =>
    actionState.id === id && actionState.type === type

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Elections</h1>
          <p style={styles.subtitle}>Create and manage election windows.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={() => navigate('/admin')}>
            Back to Dashboard
          </button>
          <button
            style={styles.primaryButton}
            onClick={() => {
              setShowForm((prev) => !prev)
              if (showForm) {
                resetForm()
              }
            }}
          >
            {showForm ? 'Close Form' : 'Create Election'}
          </button>
        </div>
      </header>

      {error ? <p style={styles.error}>{error}</p> : null}

      {showForm ? (
        <form style={styles.form} onSubmit={handleSubmit}>
          <h2 style={styles.formTitle}>
            {editingElection ? 'Edit Election' : 'Create Election'}
          </h2>

          <label style={styles.label} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            style={styles.input}
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            disabled={submitting}
          />

          <label style={styles.label} htmlFor="startTime">
            Start Time
          </label>
          <input
            id="startTime"
            type="datetime-local"
            style={styles.input}
            value={form.startTime}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, startTime: event.target.value }))
            }
            disabled={submitting}
          />

          <label style={styles.label} htmlFor="endTime">
            End Time
          </label>
          <input
            id="endTime"
            type="datetime-local"
            style={styles.input}
            value={form.endTime}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, endTime: event.target.value }))
            }
            disabled={submitting}
          />

          <div style={styles.formActions}>
            <button type="submit" style={styles.primaryButton} disabled={submitting}>
              {submitting ? 'Saving...' : editingElection ? 'Update Election' : 'Create'}
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              disabled={submitting}
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading elections...</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Start Time</th>
                <th style={styles.th}>End Time</th>
                <th style={styles.th}>is_active</th>
                <th style={styles.th}>results_approved</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {elections.length === 0 ? (
                <tr>
                  <td style={styles.emptyCell} colSpan={6}>
                    No elections found.
                  </td>
                </tr>
              ) : (
                elections.map((election) => {
                  const started = hasElectionStarted(election)

                  return (
                    <tr key={election.id}>
                      <td style={styles.td}>{election.title || '--'}</td>
                      <td style={styles.td}>{formatDate(election.start_time)}</td>
                      <td style={styles.td}>{formatDate(election.end_time)}</td>
                      <td style={styles.td}>{election.is_active ? 'true' : 'false'}</td>
                      <td style={styles.td}>
                        {election.results_approved ? 'true' : 'false'}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionGrid}>
                          <button
                            style={styles.actionButton}
                            onClick={() => handleStart(election)}
                            disabled={election.is_active || isActionBusy(election.id, 'start')}
                          >
                            {isActionBusy(election.id, 'start')
                              ? 'Starting...'
                              : 'Start Election'}
                          </button>
                          <button
                            style={styles.actionButton}
                            onClick={() => handleEnd(election)}
                            disabled={!election.is_active || isActionBusy(election.id, 'end')}
                          >
                            {isActionBusy(election.id, 'end') ? 'Ending...' : 'End Election'}
                          </button>
                          <button
                            style={styles.actionButton}
                            onClick={() => handleApprove(election)}
                            disabled={
                              election.results_approved ||
                              election.is_active ||
                              isActionBusy(election.id, 'approve')
                            }
                          >
                            {isActionBusy(election.id, 'approve')
                              ? 'Approving...'
                              : 'Approve Results'}
                          </button>
                          <button
                            style={styles.secondaryActionButton}
                            onClick={() => handleEdit(election)}
                            disabled={started || isActionBusy(election.id, 'edit')}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.dangerActionButton}
                            onClick={() => handleDelete(election)}
                            disabled={started || isActionBusy(election.id, 'delete')}
                          >
                            {isActionBusy(election.id, 'delete')
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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
    gap: '0.9rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.8rem',
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
  error: {
    margin: 0,
    color: '#b42318',
    fontWeight: 600,
  },
  form: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    padding: '0.9rem',
    display: 'grid',
    gap: '0.45rem',
  },
  formTitle: {
    margin: '0 0 0.2rem',
  },
  label: {
    fontWeight: 600,
    color: '#2d4671',
  },
  input: {
    height: '40px',
    border: '1px solid #c8d4e7',
    borderRadius: '8px',
    padding: '0 0.65rem',
    background: '#fff',
  },
  formActions: {
    marginTop: '0.4rem',
    display: 'flex',
    gap: '0.5rem',
  },
  loadingWrap: {
    background: '#f8fafe',
    border: '1px solid #d6dfed',
    borderRadius: '10px',
    minHeight: '200px',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '0.3rem',
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
    minWidth: '980px',
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
    color: '#5a7198',
    textAlign: 'center',
  },
  actionGrid: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  actionButton: {
    border: 0,
    background: '#08255d',
    color: '#fff',
    borderRadius: '6px',
    padding: '0.45rem 0.62rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  secondaryActionButton: {
    border: '1px solid #c2d0e3',
    background: '#fff',
    color: '#08255d',
    borderRadius: '6px',
    padding: '0.45rem 0.62rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  dangerActionButton: {
    border: 0,
    background: '#b42318',
    color: '#fff',
    borderRadius: '6px',
    padding: '0.45rem 0.62rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
}
