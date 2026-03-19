/**
 * authService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Supabase authentication calls go through here.
 * Components never call supabase.auth.* directly — they call these functions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const ADMIN_ROLES  = new Set(['election_officer', 'super_admin'])
const EMAIL_DOMAIN = '@st.ug.edu.gh'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the university email from a 10-digit student ID */
export function buildStudentEmail(studentId) {
  return `${studentId}${EMAIL_DOMAIN}`
}

/** Fetch the profiles row for a given user UUID. Returns null on failure. */
async function fetchProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[authService] fetchProfile error:', error.message)
    return null
  }
  return data
}

// ─── Student signup ──────────────────────────────────────────────────────────

/**
 * Register a new student account.
 *
 * @param {{ studentId: string, fullName: string, password: string }} params
 * @returns {{ success: boolean, requiresConfirmation?: boolean, message?: string, error?: string }}
 */
export async function signUpStudent({ studentId, fullName, password }) {
  const email = buildStudentEmail(studentId)

  // Step 1 — Create the Supabase auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name:  fullName.trim(),
        student_id: studentId,
      },
    },
  })

  if (signUpError) {
    // Surface a friendly message for the most common error
    const msg = signUpError.message?.toLowerCase() ?? ''
    if (
      msg.includes('user already registered') ||
      msg.includes('already registered') ||
      msg.includes('email already in use')
    ) {
      return {
        success: false,
        error: 'An account with this Student ID already exists. Please log in instead.',
      }
    }
    return { success: false, error: signUpError.message }
  }

  const userId    = signUpData?.user?.id
  const identities = signUpData?.user?.identities ?? []

  // When email confirmation is required, Supabase returns the user but with
  // an empty identities array — the account exists, it just isn't confirmed.
  if (!userId || identities.length === 0) {
    return {
      success: true,
      requiresConfirmation: true,
      message:
        'Account created! Please check your inbox and confirm your email address, then log in.',
    }
  }

  // Step 2 — Ensure a profiles row exists.
  // The handle_new_user DB trigger (Section 3 of supabase_migration.sql) should
  // have already created it.  This insert is a safety net — we ignore error
  // code 23505 (unique_violation) which means the trigger already ran.
  const { error: profileError } = await supabase.from('profiles').insert({
    id:        userId,
    role:      'student',
    full_name: fullName.trim(),
  })

  if (profileError && profileError.code !== '23505') {
    // Non-fatal: auth user was created. Log it and continue.
    console.warn('[authService] Profile insert warning:', profileError.message)
  }

  return {
    success: true,
    requiresConfirmation: false,
    message: 'Account created successfully!',
    userId,
  }
}

// ─── Student login ───────────────────────────────────────────────────────────

/**
 * Log in an existing student.
 *
 * @param {{ studentId: string, password: string }} params
 * @returns {{ success: boolean, role?: string, error?: string }}
 */
export async function loginStudent({ studentId, password }) {
  const email = buildStudentEmail(studentId)

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password })

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? ''
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid email or password') ||
      msg.includes('email not confirmed')
    ) {
      if (msg.includes('email not confirmed')) {
        return {
          success: false,
          error: 'Please confirm your email address before logging in. Check your inbox.',
        }
      }
      return { success: false, error: 'Incorrect Student ID or password.' }
    }
    return { success: false, error: authError.message }
  }

  const userId = authData?.user?.id
  if (!userId) return { success: false, error: 'Login succeeded but user details were missing.' }

  const profile = await fetchProfile(userId)
  const role    = profile?.role ?? 'student'

  // Prevent admin accounts from using the student portal
  if (ADMIN_ROLES.has(role)) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Admin accounts must use the Admin Portal at /admin/login',
    }
  }

  return { success: true, role }
}

// ─── Admin login ─────────────────────────────────────────────────────────────

/**
 * Log in an admin by full email address.
 *
 * @param {{ email: string, password: string }} params
 * @returns {{ success: boolean, role?: string, error?: string }}
 */
export async function loginAdmin({ email, password }) {
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? ''
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid email or password')
    ) {
      return { success: false, error: 'Incorrect email or password.' }
    }
    return { success: false, error: authError.message }
  }

  const userId = authData?.user?.id
  if (!userId) return { success: false, error: 'Login succeeded but user details were missing.' }

  const profile = await fetchProfile(userId)
  const role    = profile?.role

  if (!ADMIN_ROLES.has(role)) {
    // Not an admin — sign out and reject
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Access denied. This portal is for Election Officers and Administrators only.',
    }
  }

  return { success: true, role }
}

// ─── Admin account creation ───────────────────────────────────────────────────

/**
 * Create a new admin account (super_admin only).
 * Uses signUp so the calling admin's session is preserved.
 *
 * IMPORTANT: In Supabase, calling signUp while already logged in does NOT
 * switch the session — it creates a new user and returns its data.
 * The current session remains intact.
 *
 * @param {{ email: string, password: string, fullName: string, role: 'election_officer'|'super_admin' }} params
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
export async function createAdminAccount({ email, password, fullName, role }) {
  if (!ADMIN_ROLES.has(role)) {
    return { success: false, error: `Invalid role "${role}".` }
  }

  const cleanEmail = email.trim().toLowerCase()

  // Create the auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email:    cleanEmail,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        is_admin:  true,
      },
    },
  })

  if (signUpError) {
    const msg = signUpError.message?.toLowerCase() ?? ''
    if (msg.includes('already registered') || msg.includes('user already registered')) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: signUpError.message }
  }

  const userId     = signUpData?.user?.id
  const identities = signUpData?.user?.identities ?? []

  // Handle email-confirmation-required scenario
  if (!userId || identities.length === 0) {
    return {
      success: true,
      requiresConfirmation: true,
      message:
        `Admin account created for ${cleanEmail}. ` +
        `They must confirm their email before logging in, then you must set their role to "${role}" in the Manage Admins page.`,
    }
  }

  // Upsert profile with admin role
  // Using upsert here (not insert) because this is an intentional admin action,
  // not a first-time signup — the profile may already exist from the trigger.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, role, full_name: fullName.trim() },
      { onConflict: 'id' }
    )

  if (profileError) {
    return {
      success: false,
      error: `Account created but role assignment failed: ${profileError.message}`,
    }
  }

  return {
    success: true,
    requiresConfirmation: false,
    message: `Admin account created for ${cleanEmail} with role "${role}".`,
    userId,
  }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/** Sign out the current user */
export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) console.warn('[authService] logout error:', error.message)
}

// ─── Session ─────────────────────────────────────────────────────────────────

/** Return the currently authenticated user object, or null */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user ?? null
}

/** Return the full profile row for the current user, or null */
export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  return fetchProfile(user.id)
}