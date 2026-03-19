import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../services/supabase'
import AdminShell from '../../components/admin/AdminShell'

const PAGE_SIZE = 20
const ADMIN_ROLES = new Set(['super_admin', 'election_officer', 'admin'])

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function EventBadge({ event }) {
  const MAP = {
    vote_cast:          { label: 'Vote Cast',        bg: '#dbeafe', color: '#1e40af' },
    results_approved:   { label: 'Results Approved', bg: '#dcfce7', color: '#15803d' },
    election_started:   { label: 'Election Started', bg: '#fef9c3', color: '#92400e' },
    election_ended:     { label: 'Election Ended',   bg: '#fee2e2', color: '#991b1b' },
    admin_login:        { label: 'Admin Login',      bg: '#ede9fe', color: '#5b21b6' },
  }
  const style = MAP[event] ?? { label: event ?? 'Unknown', bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      display: 'inline-block',
      background: style.bg, color: style.color,
      borderRadius: '999px', padding: '2px 10px',
      fontSize: '0.72rem', fontWeight: '700',
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  )
}

export default function AuditLogs() {
  const mountedRef = useRef(true)

  const [logs,       setLogs]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [page,       setPage]       = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [filterEvent, setFilterEvent] = useState('')
  const [filterElection, setFilterElection] = useState('')
  const [elections,  setElections]  = useState([])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Load elections for filter dropdown
  useEffect(() => {
    supabase
      .from('elections')
      .select('id, title, name')
      .order('start_time', { ascending: false })
      .then(({ data }) => {
        if (mountedRef.current) setElections(data ?? [])
      })
  }, [])

  const loadLogs = useCallback(async (currentPage, eventFilter, electionFilter) => {
    if (!mountedRef.current) return
    setLoading(true)
    setError('')

    const from = currentPage * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let query = supabase
      .from('vote_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (eventFilter)    query = query.eq('event', eventFilter)
    if (electionFilter) query = query.eq('election_id', electionFilter)

    const { data, count, error: qErr } = await query

    if (!mountedRef.current) return

    if (qErr) {
      // Table might not exist yet — show a helpful empty state instead of crashing
      if (qErr.code === '42P01') {
        setError('Audit log table does not exist yet. Run the supabase_fixes.sql migration first.')
      } else {
        setError(qErr.message || 'Failed to load audit logs.')
      }
      setLogs([])
      setTotalCount(0)
    } else {
      setLogs(data ?? [])
      setTotalCount(count ?? 0)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadLogs(page, filterEvent, filterElection)
  }, [loadLogs, page, filterEvent, filterElection])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleFilterChange = (newEvent, newElection) => {
    setPage(0)   // reset to first page on filter change
    setFilterEvent(newEvent)
    setFilterElection(newElection)
  }

  return (
    <AdminShell title="Audit Logs" subtitle="Review all system and administrative activity">
      <style>{`
        .al-row:hover td { background: #f8fafc !important; }
        .al-page-btn:hover:not(:disabled) { border-color: #1a56db !important; color: #1a56db !important; }
        .al-select:focus { outline: none; border-color: #1a56db !important; }
        .al-refresh:hover { border-color: #1a56db !important; color: #1a56db !important; background: #eff6ff !important; }
      `}</style>

      {/* Filter bar */}
      <div style={fc.bar}>
        <div style={fc.filterGroup}>
          <label style={fc.label}>Event Type</label>
          <select
            className="al-select"
            style={fc.select}
            value={filterEvent}
            onChange={e => handleFilterChange(e.target.value, filterElection)}
          >
            <option value="">All Events</option>
            <option value="vote_cast">Vote Cast</option>
            <option value="results_approved">Results Approved</option>
            <option value="election_started">Election Started</option>
            <option value="election_ended">Election Ended</option>
            <option value="admin_login">Admin Login</option>
          </select>
        </div>

        <div style={fc.filterGroup}>
          <label style={fc.label}>Election</label>
          <select
            className="al-select"
            style={fc.select}
            value={filterElection}
            onChange={e => handleFilterChange(filterEvent, e.target.value)}
          >
            <option value="">All Elections</option>
            {elections.map(el => (
              <option key={el.id} value={el.id}>
                {el.title ?? el.name ?? el.id}
              </option>
            ))}
          </select>
        </div>

        <div style={fc.filterGroup}>
          <label style={fc.label}>&nbsp;</label>
          <button
            className="al-refresh"
            style={fc.refreshBtn}
            onClick={() => loadLogs(page, filterEvent, filterElection)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>

        <div style={fc.countBadge}>
          {totalCount.toLocaleString()} record{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={st.errorBox}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={st.tableWrap}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th}>Timestamp</th>
              <th style={st.th}>Event</th>
              <th style={st.th}>Election ID</th>
              <th style={st.th}>Position ID</th>
              <th style={st.th}>Candidate ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={st.centerCell}>
                  <div style={st.loadingRow}>
                    <div style={st.spinner} />
                    Loading audit logs...
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={st.centerCell}>
                  <div style={st.emptyState}>
                    <span style={st.emptyIcon}>📋</span>
                    <p style={st.emptyTitle}>No log entries found</p>
                    <p style={st.emptyText}>
                      {filterEvent || filterElection
                        ? 'Try adjusting your filters.'
                        : 'Audit entries will appear here as system actions occur.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((row, i) => (
                <tr key={row.id ?? i} className="al-row">
                  <td style={st.td}>{formatDate(row.created_at)}</td>
                  <td style={st.td}><EventBadge event={row.event} /></td>
                  <td style={{ ...st.td, ...st.mono }}>{row.election_id ? shortId(row.election_id) : '—'}</td>
                  <td style={{ ...st.td, ...st.mono }}>{row.position_id ? shortId(row.position_id) : '—'}</td>
                  <td style={{ ...st.td, ...st.mono }}>{row.candidate_id ? shortId(row.candidate_id) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={st.pagination}>
          <button
            className="al-page-btn"
            style={{ ...st.pageBtn, ...(page === 0 ? st.pageBtnDisabled : {}) }}
            disabled={page === 0}
            onClick={() => setPage(0)}
          >«</button>
          <button
            className="al-page-btn"
            style={{ ...st.pageBtn, ...(page === 0 ? st.pageBtnDisabled : {}) }}
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >‹ Prev</button>

          <span style={st.pageInfo}>
            Page {page + 1} of {totalPages}
          </span>

          <button
            className="al-page-btn"
            style={{ ...st.pageBtn, ...(page >= totalPages - 1 ? st.pageBtnDisabled : {}) }}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >Next ›</button>
          <button
            className="al-page-btn"
            style={{ ...st.pageBtn, ...(page >= totalPages - 1 ? st.pageBtnDisabled : {}) }}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >»</button>
        </div>
      )}
    </AdminShell>
  )
}

// Show only first 8 chars of a UUID for display
function shortId(uuid) {
  return uuid ? uuid.slice(0, 8) + '…' : '—'
}

const fc = {
  bar: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '14px', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'flex-end',
    gap: '1rem', flexWrap: 'wrap',
  },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: {
    fontSize: '0.72rem', fontWeight: '700',
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  select: {
    height: '38px', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '0 10px',
    background: '#f9fafb', color: '#0f172a',
    fontSize: '0.85rem', fontFamily: "'Sora', sans-serif",
    cursor: 'pointer', minWidth: '160px',
    transition: 'border-color 0.15s',
  },
  refreshBtn: {
    height: '38px', display: 'flex', alignItems: 'center', gap: '6px',
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '0 14px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
  },
  countBadge: {
    marginLeft: 'auto', alignSelf: 'flex-end',
    background: '#f3f4f6', borderRadius: '999px',
    padding: '5px 14px', fontSize: '0.78rem',
    fontWeight: '700', color: '#374151',
    whiteSpace: 'nowrap',
  },
}

const st = {
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', overflow: 'hidden',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left', fontWeight: '700',
    padding: '11px 14px',
    borderBottom: '1px solid #e5e7eb',
    color: '#374151', background: '#f9fafb',
    fontSize: '0.75rem', textTransform: 'uppercase',
    letterSpacing: '0.05em', whiteSpace: 'nowrap',
  },
  td: {
    padding: '11px 14px',
    borderBottom: '1px solid #f3f4f6',
    color: '#0f172a', verticalAlign: 'middle',
  },
  mono: {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '0.78rem', color: '#6b7280',
  },
  centerCell: {
    padding: '2.5rem', textAlign: 'center',
    color: '#6b7280',
  },
  loadingRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '10px',
    fontWeight: '600', fontSize: '0.875rem',
  },
  spinner: {
    width: '18px', height: '18px',
    border: '2px solid #e5e7eb', borderTopColor: '#1a56db',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '6px',
  },
  emptyIcon: { fontSize: '2rem', marginBottom: '4px' },
  emptyTitle: { margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' },
  emptyText: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  pagination: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '6px',
    flexWrap: 'wrap',
  },
  pageBtn: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '7px 14px',
    color: '#374151', fontSize: '0.82rem', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s, color 0.15s',
  },
  pageBtnDisabled: {
    opacity: 0.4, cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  pageInfo: {
    padding: '0 10px', fontSize: '0.82rem',
    color: '#6b7280', fontWeight: '600',
  },
}