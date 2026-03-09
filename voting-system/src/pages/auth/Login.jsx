import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!/^\d{10}$/.test(studentId)) {
      setError('Student ID must be exactly 10 digits.')
      return
    }

    setLoading(true)

    try {
      const email = `${studentId}@st.ug.edu.gh`

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (authError) throw authError

      const userId = authData?.user?.id
      if (!userId) {
        throw new Error('Login succeeded but user details were missing.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      const role = profile?.role

      if (role === 'student') {
        navigate('/dashboard')
        return
      }

      if (role === 'election_officer' || role === 'super_admin') {
        navigate('/admin')
        return
      }

      throw new Error('Role not recognized for this account.')
    } catch (err) {
      setError(err?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>

      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Login</h1>

        <label htmlFor="studentId" style={styles.label}>
          Student ID
        </label>
        <input
          id="studentId"
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={studentId}
          onChange={(event) =>
            setStudentId(event.target.value.replace(/\D/g, ''))
          }
          placeholder="Enter 10-digit student ID"
          style={styles.input}
          disabled={loading}
        />

        <label htmlFor="password" style={styles.label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          style={styles.input}
          disabled={loading}
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? (
            <span style={styles.loadingWrap}>
              <span style={styles.spinner} />
              Authenticating...
            </span>
          ) : (
            'Login'
          )}
        </button>
      </form>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  form: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1.5rem',
    border: '1px solid #ddd',
    borderRadius: '12px',
  },
  title: {
    margin: '0 0 0.5rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  input: {
    height: '42px',
    padding: '0 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
  },
  error: {
    color: '#b42318',
    fontSize: '0.9rem',
    margin: 0,
  },
  button: {
    marginTop: '0.25rem',
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  loadingWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid #ffffff66',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
