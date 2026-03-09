import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const redirectTimeoutRef = useRef(null)

  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!/^\d{10}$/.test(studentId)) {
      setError('Student ID must be exactly 10 digits.')
      return
    }

    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const email = `${studentId}@st.ug.edu.gh`

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              student_id: studentId,
            },
          },
        })

      if (signUpError) throw signUpError

      const userId = signUpData?.user?.id
      if (!userId) {
        throw new Error('Signup completed but no user record was returned.')
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        role: 'student',
      })

      if (profileError) throw profileError

      setSuccess('Signup successful. Redirecting to login...')
      redirectTimeoutRef.current = setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err) {
      setError(err?.message || 'Signup failed. Please try again.')
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
        <h1 style={styles.title}>Create Account</h1>

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

        <label htmlFor="fullName" style={styles.label}>
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Enter full name"
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

        <label htmlFor="confirmPassword" style={styles.label}>
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          style={styles.input}
          disabled={loading}
        />

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

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
              Creating account...
            </span>
          ) : (
            'Sign Up'
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
  success: {
    color: '#027a48',
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
