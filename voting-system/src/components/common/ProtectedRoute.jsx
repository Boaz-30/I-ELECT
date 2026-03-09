import { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'

function Unauthorized() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontSize: '1.1rem',
        fontWeight: 600,
      }}
    >
      Unauthorized
    </div>
  )
}

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useContext(AuthContext)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRole && role !== allowedRole) {
    return <Unauthorized />
  }

  return children
}
