import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login: loginWithContext } = useAuth()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedStudentId = studentId.trim()
    if (!/^\d{10}$/.test(trimmedStudentId)) {
      setError('Student ID must be 10 digits')
      return
    }
    const email = `${trimmedStudentId}@st.ug.edu.gh`

    setLoading(true)

    try {
      const { user } = await loginWithContext({ email, password })
      const userId = user?.id

      let role = null
      if (userId) {
        const { data: profileRecord, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        if (profileError) {
          console.error('Failed to fetch user role:', profileError)
        } else {
          role = profileRecord?.role ?? null
        }
      }

      if (role && role !== 'student') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err?.message ?? 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 md:px-8">
        <div className="grid w-full max-w-md gap-6">
          <header className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-wide">UV</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">
              Log in with your Student ID to access the voting portal.
            </p>
          </header>

          <form
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={handleLogin}
          >
            <div className="grid gap-4">
              <div>
                <label htmlFor="studentId" className="text-sm font-semibold text-slate-700">
                  Student ID
                </label>
                <input
                  id="studentId"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit student ID"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Authenticating...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </div>

            <p className="mt-5 text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-semibold text-blue-700 hover:text-blue-800">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
