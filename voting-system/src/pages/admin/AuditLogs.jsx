import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import AdminShell from '../../components/admin/AdminShell'
import AdminShell from '../../components/admin/AdminShell'

const PAGE_SIZE = 10
const ADMIN_ROLES = new Set(['super_admin', 'election_officer', 'admin'])

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString()
}

export default function AuditLogs() {
  const navigate = useNavigate()
  const { role, loading: authLoading } = useAuth()
  const isAdmin = ADMIN_ROLES.has(role)

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount]
  )

  const fetchLogs = async (pageNumber = page, studentIdFilter = search) => {
    setLoading(true)
    setError('')

    const from = (pageNumber - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('votes')
      .select('id, student_id, ip_address, user_agent, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (studentIdFilter.trim()) {
      query = query.ilike('student_id', `%${studentIdFilter.trim()}%`)
    }

    const { data, error: fetchError, count } = await query

    if (fetchError) {
      setError(fetchError.message || 'Failed to load audit logs.')
      setLogs([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setLogs(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) {
      setLoading(false)
      return
    }

    fetchLogs(1, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    fetchLogs(1, search)
  }

  const handlePrev = () => {
    const next = Math.max(1, page - 1)
    setPage(next)
    fetchLogs(next, search)
  }

  const handleNext = () => {
    const next = Math.min(totalPages, page + 1)
    setPage(next)
    fetchLogs(next, search)
  }

  if (authLoading) {
    return (
      <main className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
          <div className="grid min-h-[240px] place-items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/20 border-t-slate-900" />
              <p className="text-sm font-semibold">Loading audit logs...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black tracking-tight">Access Denied</h1>
            <p className="mt-2 text-sm text-slate-600">
              Admin access is required to view audit logs.
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
    <AdminShell title="Audit Logs" subtitle="Review vote activity and metadata.">
      <div className="mx-auto w-full max-w-6xl">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchSubmit}>
          <input
            className="h-10 w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
            placeholder="Search by student ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            type="submit"
          >
            Search
          </button>
        </form>

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
                <p className="text-sm font-semibold">Loading audit logs...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vote ID
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Student ID
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      IP Address
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      User Agent
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                        colSpan={5}
                      >
                        No audit logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="transition hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-900">
                          {log.id}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-900">
                          {log.student_id ?? '--'}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                          {log.ip_address ?? '--'}
                        </td>
                        <td
                          className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700"
                          title={log.user_agent ?? ''}
                        >
                          {log.user_agent ? log.user_agent.slice(0, 60) : '--'}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handlePrev}
            disabled={page <= 1 || loading}
            type="button"
          >
            Prev
          </button>
          <span className="text-sm font-semibold text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleNext}
            disabled={page >= totalPages || loading}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </AdminShell>
  )
}
