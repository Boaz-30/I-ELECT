import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'

export const AuthContext = createContext(undefined)

async function getRoleFromTables(userId) {
  if (!userId) return null

  const { data: profileRecord, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('Failed to fetch role from profiles:', profileError)
  } else if (profileRecord?.role) {
    return profileRecord.role
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (adminError) {
    console.error('Failed to fetch role from admins:', adminError)
    return null
  }

  if (adminRecord) return 'admin'

  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (studentError) {
    console.error('Failed to fetch role from students:', studentError)
    return null
  }

  return studentRecord ? 'student' : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const syncAuthState = async (session) => {
      const nextUser = session?.user ?? null

      if (!isActive) return
      setUser(nextUser)

      if (!nextUser) {
        setRole(null)
        return
      }

      const nextRole = await getRoleFromTables(nextUser.id)
      if (isActive) {
        setRole(nextRole)
      }
    }

    const initAuth = async () => {
      setLoading(true)

      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Failed to get auth session:', error)
      }

      await syncAuthState(data?.session ?? null)

      if (isActive) {
        setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true)
      await syncAuthState(session)

      if (isActive) {
        setLoading(false)
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async ({ email, password }) => {
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      throw error
    }

    const nextUser = data?.user ?? null
    setUser(nextUser)

    if (nextUser) {
      const nextRole = await getRoleFromTables(nextUser.id)
      setRole(nextRole)
    } else {
      setRole(null)
    }

    setLoading(false)
    return data
  }

  const logout = async () => {
    setLoading(true)

    const { error } = await supabase.auth.signOut()
    if (error) {
      setLoading(false)
      throw error
    }

    setUser(null)
    setRole(null)
    setLoading(false)
  }

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, role, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
