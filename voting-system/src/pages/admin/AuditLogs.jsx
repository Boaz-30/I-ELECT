import { useNavigate } from 'react-router-dom'

export default function AuditLogs() {
  const navigate = useNavigate()

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Audit Logs</h1>
      <p style={styles.subtitle}>Review administrative and system activity here.</p>
      <button style={styles.button} onClick={() => navigate('/admin')}>
        Back to Admin Dashboard
      </button>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '0.6rem',
    background: '#eef2f7',
    color: '#0b234e',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    textAlign: 'center',
    padding: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
  },
  subtitle: {
    margin: 0,
    color: '#51678f',
  },
  button: {
    border: 0,
    borderRadius: '8px',
    background: '#08255d',
    color: '#fff',
    padding: '0.7rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
}
