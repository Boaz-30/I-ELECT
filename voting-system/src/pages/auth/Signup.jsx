import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

export default function Signup() {
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedStudentId = studentId.trim()
    const trimmedFullName = fullName.trim()

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!/^\d{10}$/.test(trimmedStudentId)) {
      setError('Student ID must be 10 digits')
      return
    }

    if (!trimmedFullName) {
      setError('Full name is required')
      return
    }

    const email = `${trimmedStudentId}@st.ug.edu.gh`

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: trimmedFullName,
          student_id: trimmedStudentId,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data?.user?.id) {
      setError('Signup completed but no user record was returned.')
      setLoading(false)
      return
    }

    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="page-animate-in min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 md:px-8">
        <div className="grid w-full max-w-md gap-6">
          <header className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-wide">UV</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm text-slate-600">
              Register with your Student ID to participate in elections.
            </p>
          </header>

          <form
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={handleSignup}
          >
            <div className="grid gap-4">
              <div>
                <label htmlFor="fullName" className="text-sm font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter full name"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

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
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 disabled:cursor-not-allowed disabled:opacity-70"
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
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                  autoComplete="new-password"
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>

            <p className="mt-5 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
