import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import AdminShell from '../../components/admin/AdminShell'

const ADMIN_ROLES = ['election_officer', 'super_admin']

function RoleBadge({ role }) {
  const MAP = {
    super_admin:      { label: 'Super Admin',   bg: '#ede9fe', color: '#5b21b6' },
    election_officer: { label: 'Officer',       bg: '#dbeafe', color: '#1e40af' },
    student:          { label: 'Student',       bg: '#f3f4f6', color: '#374151' },
  }
  const s = MAP[role] ?? { label: role ?? 'Unknown', bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg, color: s.color,
      borderRadius: '999px', padding: '2px 10px',
      fontSize: '0.72rem', fontWeight: '700',
    }}>
      {s.label}
    </span>
  )
}

export default function ManageAdmins() {
  const { role: myRole, user: myUser } = useAuth()
  const mountedRef = useRef(true)

  const [admins,    setAdmins]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [busy,      setBusy]      = useState(null)  // id of row being mutated

  // New admin form
  const [showForm,  setShowForm]  = useState(false)
  const [formId,    setFormId]    = useState('')      // student ID
  const [formRole,  setFormRole]  = useState('election_officer')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadAdmins = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, role, created_at')
      .in('role', ['election_officer', 'super_admin'])
      .order('created_at', { ascending: false })

    if (!mountedRef.current) return
    if (qErr) { setError(qErr.message || 'Failed to load admins.') }
    else { setAdmins(data ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { loadAdmins() }, [loadAdmins])

  const clearMessages = () => { setError(''); setSuccess('') }

  const handleGrantAccess = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!/^\d{10}$/.test(formId)) {
      setError('Student ID must be exactly 10 digits.')
      return
    }

    setSaving(true)

    // Resolve student ID → auth user via email convention
    const email = `${formId}@st.ug.edu.gh`

    // We can't look up auth users from the client directly.
    // Instead we update the profiles row by looking up via the users' metadata.
    const { data: profileRows, error: lookupErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id',
        // sub-select: find user id whose email matches
        // This only works if profiles.id = auth.users.id (standard setup)
        // We'll match by looking up through auth admin API — but that's server-side.
        // Safest client approach: look for a profile whose associated auth user has this email.
        // Since we can't query auth.users from client, we store student_id in user_metadata
        // and can filter profiles via a join or RPC.
        // For now: surface a clear error if not found, admin must use Supabase dashboard.
        formId   // placeholder — see note below
      )
      .maybeSingle()

    // NOTE: The correct approach is a Supabase Edge Function or RPC that:
    // 1. Looks up the user by email in auth.users (server-side only)
    // 2. Updates profiles.role for that user's id
    // We call an RPC here if available, otherwise surface a helpful message.
    const { error: rpcErr } = await supabase.rpc('grant_admin_role', {
      p_student_id: formId,
      p_role: formRole,
    })

    if (!mountedRef.current) return

    if (rpcErr) {
      // RPC might not exist yet — show a helpful fallback message
      if (rpcErr.code === '42883' || rpcErr.message?.includes('does not exist')) {
        setError(
          'The grant_admin_role RPC does not exist yet. ' +
          'To grant admin access, go to your Supabase Dashboard → Table Editor → profiles, ' +
          `find the user with email ${formId}@st.ug.edu.gh, and manually set their role to "${formRole}".`
        )
      } else {
        setError(rpcErr.message || 'Failed to grant admin access.')
      }
    } else {
      setSuccess(`Admin access granted to student ${formId} as ${formRole}.`)
      setFormId('')
      setShowForm(false)
      await loadAdmins()
    }

    setSaving(false)
  }

  const handleRevoke = async (admin) => {
    if (admin.id === myUser?.id) {
      setError('You cannot revoke your own admin access.')
      return
    }
    clearMessages()
    setBusy(admin.id)

    const { error: revokeErr } = await supabase
      .from('profiles')
      .update({ role: 'student' })
      .eq('id', admin.id)

    if (!mountedRef.current) return
    if (revokeErr) { setError(revokeErr.message || 'Failed to revoke access.') }
    else { setSuccess('Admin access revoked.') }

    setBusy(null)
    await loadAdmins()
  }

  if (myRole !== 'super_admin') {
    return (
      <AdminShell title="Manage Admins" subtitle="Admin user management">
        <div style={st.accessDenied}>
          <span style={{ fontSize: '2rem' }}>🔒</span>
          <p style={st.accessTitle}>Super Admin access required</p>
          <p style={st.accessSub}>Only super administrators can manage admin accounts.</p>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="Manage Admins" subtitle="Grant and revoke administrative access">
      <style>{`
        .ma-row:hover td { background: #f8fafc !important; }
        .grant-btn:hover { background: #1e429f !important; }
        .revoke-btn:hover:not(:disabled) { background: #991b1b !important; }
        .ma-input:focus { outline: none; border-color: #1a56db !important; box-shadow: 0 0 0 3px rgba(26,86,219,0.1) !important; }
      `}</style>

      {/* Action bar */}
      <div style={st.actionBar}>
        <p style={st.countText}>
          {admins.length} admin account{admins.length !== 1 ? 's' : ''}
        </p>
        <button
          style={st.grantBtn}
          className="grant-btn"
          onClick={() => { setShowForm(v => !v); clearMessages() }}
        >
          {showForm ? '✕ Cancel' : '+ Grant Admin Access'}
        </button>
      </div>

      {/* Grant form */}
      {showForm && (
        <form style={st.form} onSubmit={handleGrantAccess}>
          <h3 style={st.formTitle}>Grant Admin Access</h3>
          <div style={st.formRow}>
            <div style={st.field}>
              <label style={st.label} htmlFor="adminStudentId">Student ID</label>
              <input
                id="adminStudentId"
                className="ma-input"
                style={st.input}
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={formId}
                onChange={e => setFormId(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit Student ID"
                disabled={saving}
              />
            </div>
            <div style={st.field}>
              <label style={st.label} htmlFor="adminRole">Role</label>
              <select
                id="adminRole"
                className="ma-input"
                style={st.select}
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                disabled={saving}
              >
                <option value="election_officer">Election Officer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div style={st.field}>
              <label style={st.label}>&nbsp;</label>
              <button
                type="submit"
                className="grant-btn"
                style={{ ...st.grantBtn, ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                disabled={saving}
              >
                {saving ? 'Granting…' : 'Grant Access'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Messages */}
      {error   && <div style={st.errorBox}>{error}</div>}
      {success && <div style={st.successBox}>{success}</div>}

      {/* Table */}
      <div style={st.tableWrap}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th}>User ID</th>
              <th style={st.th}>Role</th>
              <th style={st.th}>Granted</th>
              <th style={st.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={st.centerCell}>
                  <div style={st.loadingRow}>
                    <div style={st.spinner} />
                    Loading admins…
                  </div>
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={4} style={st.centerCell}>No admin accounts found.</td>
              </tr>
            ) : (
              admins.map(admin => (
                <tr key={admin.id} className="ma-row">
                  <td style={{ ...st.td, ...st.mono }}>{admin.id.slice(0, 16)}…</td>
                  <td style={st.td}><RoleBadge role={admin.role} /></td>
                  <td style={st.td}>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}</td>
                  <td style={st.td}>
                    {admin.id === myUser?.id ? (
                      <span style={st.selfTag}>You</span>
                    ) : (
                      <button
                        className="revoke-btn"
                        style={{ ...st.revokeBtn, ...(busy === admin.id ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                        disabled={busy === admin.id}
                        onClick={() => handleRevoke(admin)}
                      >
                        {busy === admin.id ? 'Revoking…' : 'Revoke Access'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}

const st = {
  accessDenied: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', padding: '3rem',
    textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  accessTitle: { margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' },
  accessSub:   { margin: 0, color: '#6b7280', fontSize: '0.875rem' },
  actionBar: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '10px',
  },
  countText: { margin: 0, color: '#6b7280', fontSize: '0.85rem', fontWeight: '600' },
  grantBtn: {
    background: 'linear-gradient(135deg,#1a56db,#6366f1)',
    border: 'none', borderRadius: '10px', color: '#fff',
    padding: '9px 18px', fontSize: '0.875rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.15s',
  },
  form: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '14px', padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  formTitle: { margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' },
  formRow: {
    display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: {
    fontSize: '0.72rem', fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  input: {
    height: '38px', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '0 12px',
    background: '#f9fafb', color: '#0f172a',
    fontSize: '0.875rem', fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s, box-shadow 0.15s',
    minWidth: '180px',
  },
  select: {
    height: '38px', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '0 10px',
    background: '#f9fafb', color: '#0f172a',
    fontSize: '0.875rem', fontFamily: "'Sora', sans-serif",
    transition: 'border-color 0.15s',
    minWidth: '160px', cursor: 'pointer',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '10px', padding: '12px 16px',
    color: '#991b1b', fontSize: '0.875rem', fontWeight: '500',
  },
  successBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '10px', padding: '12px 16px',
    color: '#15803d', fontSize: '0.875rem', fontWeight: '500',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    textAlign: 'left', fontWeight: '700', padding: '11px 14px',
    borderBottom: '1px solid #e5e7eb', color: '#374151',
    background: '#f9fafb', fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: {
    padding: '11px 14px', borderBottom: '1px solid #f3f4f6',
    color: '#0f172a', verticalAlign: 'middle',
  },
  mono: {
    fontFamily: "'JetBrains Mono','Courier New',monospace",
    fontSize: '0.78rem', color: '#6b7280',
  },
  centerCell: { padding: '2rem', textAlign: 'center', color: '#6b7280' },
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
  revokeBtn: {
    background: '#dc2626', border: 'none',
    borderRadius: '7px', color: '#fff',
    padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700',
    cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.12s',
  },
  selfTag: {
    background: '#ede9fe', color: '#5b21b6',
    borderRadius: '999px', padding: '2px 10px',
    fontSize: '0.72rem', fontWeight: '700',
  },
}