import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import AdminShell from '../../components/admin/AdminShell'

function isApproved(election) {
  if (!election) return false
  if (typeof election.results_approved === 'boolean') return election.results_approved
  if (typeof election.is_results_approved === 'boolean') return election.is_results_approved
  if (typeof election.resultsApproved === 'boolean') return election.resultsApproved
  if (typeof election.results_status === 'string') {
    return election.results_status.toLowerCase() === 'approved'
  }
  return false
}

async function getCount(table, filter = null) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) {
    query = filter(query)
  }

  const { count, error } = await query
  if (error) return { count: null, error }
  return { count: count ?? 0, error: null }
}

async function getVoteCount() {
  const candidates = ['votes', 'ballots', 'election_votes']
  for (const table of candidates) {
    const result = await getCount(table)
    if (!result.error) return result.count
  }
  return null
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalStudents: null,
    totalVotes: null,
    activeElection: null,
    resultsApproved: null,
  })

  useEffect(() => {
    let isMounted = true

    const fetchSummary = async () => {
      setLoading(true)
      setError('')

      const [{ count: totalStudents, error: studentError }, totalVotes] =
        await Promise.all([
          getCount('profiles', (q) => q.eq('role', 'student')),
          getVoteCount(),
        ])

      const { data: activeElection, error: activeElectionError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      let resultsSource = activeElection
      if (!resultsSource) {
        const { data: latestElection } = await supabase
          .from('elections')
          .select('*')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()
        resultsSource = latestElection ?? null
      }

      if (!isMounted) return

      if (studentError || activeElectionError) {
        setError('Some dashboard metrics could not be loaded.')
      }

      setSummary({
        totalStudents,
        totalVotes,
        activeElection,
        resultsApproved: isApproved(resultsSource),
      })
      setLoading(false)
    }

    fetchSummary()

    return () => {
      isMounted = false
    }
  }, [])

  const adminName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Admin'

  const navItems = useMemo(() => {
    const base = [
      { label: 'Elections', path: '/admin/elections' },
      { label: 'Positions', path: '/admin/positions' },
      { label: 'Candidates', path: '/admin/candidates' },
      { label: 'Live Results', path: '/admin/live-results' },
      { label: 'Audit Logs', path: '/admin/audit-logs' },
    ]

    if (role === 'super_admin') {
      base.push({ label: 'Manage Admins', path: '/admin/manage-admins' })
    }

    return base
  }, [role])

  const activeStatus = summary.activeElection ? 'Live' : 'Inactive'
  const resultsStatus = summary.resultsApproved ? 'Approved' : 'Pending'

  return (
    <AdminShell
      title="Admin Dashboard Overview"
      subtitle="Welcome back. System status is stable and elections are currently monitored."
    >
      <div className="mx-auto w-full max-w-6xl">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 grid min-h-[180px] place-items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/20 border-t-slate-900" />
              <p className="text-sm font-semibold">Loading summary...</p>
            </div>
          </div>
        ) : (
          <section className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-500">Total Students</p>
              <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">
                {summary.totalStudents == null ? '--' : summary.totalStudents.toLocaleString()}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-500">Total Votes</p>
              <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">
                {summary.totalVotes == null ? '--' : summary.totalVotes.toLocaleString()}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-500">Active Election</p>
              <p
                className={`mt-4 text-4xl font-black tracking-tight ${
                  activeStatus === 'Live' ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {activeStatus}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-500">Results Approved</p>
              <p
                className={`mt-4 text-4xl font-black tracking-tight ${
                  resultsStatus === 'Approved' ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {resultsStatus}
              </p>
            </article>
          </section>
        )}
      </div>
    </AdminShell>
  )
}
