import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

const ADMIN_ROLES = [
  { value: 'election_officer', label: 'Election Officer' },
  { value: 'super_admin', label: 'Super Admin' },
]

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString()
}

function getName(profile) {
  return (
    profile?.full_name ??
    profile?.name ??
    profile?.email ??
    profile?.student_id ??
    'Unknown User'
  )
}

export default function ManageAdmins() {
  const navigate = useNavigate()
  const { role, loading: authLoading } = useAuth()
  const isSuperAdmin = role === 'super_admin'

  const [admins, setAdmins] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState(ADMIN_ROLES[0].value)
  const [saving, setSaving] = useState(false)
  const [actionState, setActionState] = useState({ id: null, type: '' })

  const modalUserOptions = useMemo(
    () =>
      students.map((user) => ({
        id: user.id,
        label: `${getName(user)} (${user.email ?? user.student_id ?? 'ID unknown'})`,
      })),
    [students]
  )

  const fetchAdmins = async () => {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, name, email, student_id, role, created_at')
      .neq('role', 'student')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load admin users.')
      setAdmins([])
      return
    }

    setAdmins(data ?? [])
  }

  const fetchStudents = async () => {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, name, email, student_id, role, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message || 'Failed to load student users.')
      setStudents([])
      return
    }

    setStudents(data ?? [])
  }

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    await Promise.all([fetchAdmins(), fetchStudents()])
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }

    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSuperAdmin])

  const handleRoleChange = async (userId, nextRole) => {
    setActionState({ id: userId, type: 'role' })
    setError('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: nextRole })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message || 'Failed to update role.')
    }

    setActionState({ id: null, type: '' })
    await fetchAll()
  }

  const handleRemoveAdmin = async (userId) => {
    const ok = window.confirm('Remove admin access for this user?')
    if (!ok) return

    setActionState({ id: userId, type: 'remove' })
    setError('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'student' })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message || 'Failed to remove admin role.')
    }

    setActionState({ id: null, type: '' })
    await fetchAll()
  }

  const openModal = () => {
    if (students.length === 0) {
      setError('No student accounts available to promote.')
      return
    }
    setSelectedUserId(students[0]?.id ?? '')
    setSelectedRole(ADMIN_ROLES[0].value)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
  }

  const handleAddAdmin = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedUserId) {
      setError('Select a user to promote.')
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: selectedRole })
      .eq('id', selectedUserId)

    if (updateError) {
      setError(updateError.message || 'Failed to assign admin role.')
      setSaving(false)
      return
    }

    setSaving(false)
    setModalOpen(false)
    await fetchAll()
  }

  if (authLoading) {
    return (
      <main className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
          <div className="grid min-h-[240px] place-items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/20 border-t-slate-900" />
              <p className="text-sm font-semibold">Loading admin access...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!isSuperAdmin) {
    return (
      <main className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black tracking-tight">Access Denied</h1>
            <p className="mt-2 text-sm text-slate-600">
              Only super admins can manage admin access.
            </p>
            <button
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              onClick={() => navigate('/dashboard')}
              type="button"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Manage Admins</h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              Assign roles and manage admin access.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0"
              onClick={() => navigate('/admin')}
              type="button"
            >
              Back to Admin Dashboard
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              onClick={openModal}
              type="button"
            >
              Add Admin
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="grid min-h-[220px] place-items-center p-6">
              <div className="flex items-center gap-3 text-slate-700">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/20 border-t-slate-900" />
                <p className="text-sm font-semibold">Loading admins...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Name
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Role
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Created At
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                        colSpan={4}
                      >
                        No admin accounts found.
                      </td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <tr key={admin.id} className="transition hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                          {getName(admin)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                          <select
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                            value={admin.role ?? ''}
                            onChange={(event) => handleRoleChange(admin.id, event.target.value)}
                            disabled={actionState.id === admin.id && actionState.type === 'role'}
                          >
                            {ADMIN_ROLES.map((roleOption) => (
                              <option key={roleOption.value} value={roleOption.value}>
                                {roleOption.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                          {formatDate(admin.created_at)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm">
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleRemoveAdmin(admin.id)}
                            disabled={actionState.id === admin.id && actionState.type === 'remove'}
                            type="button"
                          >
                            {actionState.id === admin.id && actionState.type === 'remove'
                              ? 'Removing...'
                              : 'Remove Admin'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">Add Admin</h2>
                <p className="mt-1 text-sm text-slate-600">Promote a student to an admin role.</p>
              </div>
              <button
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleAddAdmin}>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="adminUser">
                  Select User
                </label>
                <select
                  id="adminUser"
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  {modalUserOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="adminRole">
                  Role
                </label>
                <select
                  id="adminRole"
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  {ADMIN_ROLES.map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Assign Role'}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
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
    </main>
  )
}
