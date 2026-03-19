/**
 * electionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Supabase queries for elections, positions, and candidates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════════
// ELECTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch the single currently active election, or null.
 * @returns {{ data: object|null, error: string|null }}
 */
export async function getActiveElection() {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('is_active', true)
    .order('end_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ?? null, error: null }
}

/**
 * Fetch the most recent election (active or ended).
 * Useful for displaying results after an election closes.
 * @returns {{ data: object|null, error: string|null }}
 */
export async function getLatestElection() {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ?? null, error: null }
}

/**
 * Fetch all elections (for admin management pages).
 * @returns {{ data: object[], error: string|null }}
 */
export async function getAllElections() {
  const { data, error } = await supabase
    .from('elections')
    .select('id, title, start_time, end_time, is_active, results_approved, created_at')
    .order('start_time', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

/**
 * Create a new election.
 * @param {{ title: string, startTime: string, endTime: string }} params
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createElection({ title, startTime, endTime }) {
  const { data, error } = await supabase
    .from('elections')
    .insert({
      title:            title.trim(),
      start_time:       new Date(startTime).toISOString(),
      end_time:         new Date(endTime).toISOString(),
      is_active:        false,
      results_approved: false,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

/**
 * Update an existing election's title and times.
 * @param {string} electionId
 * @param {{ title: string, startTime: string, endTime: string }} params
 * @returns {{ error: string|null }}
 */
export async function updateElection(electionId, { title, startTime, endTime }) {
  const { error } = await supabase
    .from('elections')
    .update({
      title:      title.trim(),
      start_time: new Date(startTime).toISOString(),
      end_time:   new Date(endTime).toISOString(),
    })
    .eq('id', electionId)

  return { error: error?.message ?? null }
}

/**
 * Set an election as active (and deactivate all others first).
 * @param {string} electionId
 * @returns {{ error: string|null }}
 */
export async function startElection(electionId) {
  // Deactivate every other election first
  const { error: deactivateError } = await supabase
    .from('elections')
    .update({ is_active: false })
    .neq('id', electionId)

  if (deactivateError) return { error: deactivateError.message }

  const { error } = await supabase
    .from('elections')
    .update({ is_active: true, results_approved: false })
    .eq('id', electionId)

  return { error: error?.message ?? null }
}

/**
 * End an active election immediately.
 * @param {string} electionId
 * @returns {{ error: string|null }}
 */
export async function endElection(electionId) {
  const { error } = await supabase
    .from('elections')
    .update({
      is_active: false,
      end_time:  new Date().toISOString(),
    })
    .eq('id', electionId)

  return { error: error?.message ?? null }
}

/**
 * Approve an election's results and mark it inactive.
 * @param {string} electionId
 * @returns {{ error: string|null }}
 */
export async function approveResults(electionId) {
  const { error } = await supabase
    .from('elections')
    .update({ results_approved: true, is_active: false })
    .eq('id', electionId)

  return { error: error?.message ?? null }
}

/**
 * Delete an election (admin only, only before it starts).
 * @param {string} electionId
 * @returns {{ error: string|null }}
 */
export async function deleteElection(electionId) {
  const { error } = await supabase
    .from('elections')
    .delete()
    .eq('id', electionId)

  return { error: error?.message ?? null }
}

/**
 * Fetch live vote counts via the get_election_results RPC.
 * Admins always get data; students only get data after results_approved.
 * @param {string} electionId
 * @returns {{ data: object[], error: string|null }}
 */
export async function getElectionResults(electionId) {
  const { data, error } = await supabase.rpc('get_election_results', {
    p_election_id: electionId,
  })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}


// ═══════════════════════════════════════════════════════════════════════════
// POSITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all positions for a given election.
 * @param {string} electionId
 * @returns {{ data: object[], error: string|null }}
 */
export async function getPositions(electionId) {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('election_id', electionId)
    .order('id', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

/**
 * Create a position in an election.
 * @param {{ electionId: string, title: string, description?: string }} params
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createPosition({ electionId, title, description }) {
  const { data, error } = await supabase
    .from('positions')
    .insert({
      election_id: electionId,
      title:       title.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

/**
 * Update a position's title and description.
 * @param {string} positionId
 * @param {{ title: string, description?: string }} params
 * @returns {{ error: string|null }}
 */
export async function updatePosition(positionId, { title, description }) {
  const { error } = await supabase
    .from('positions')
    .update({
      title:       title.trim(),
      description: description?.trim() || null,
    })
    .eq('id', positionId)

  return { error: error?.message ?? null }
}

/**
 * Delete a position.
 * @param {string} positionId
 * @returns {{ error: string|null }}
 */
export async function deletePosition(positionId) {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', positionId)

  return { error: error?.message ?? null }
}


// ═══════════════════════════════════════════════════════════════════════════
// CANDIDATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all candidates for a given position.
 * @param {string} positionId
 * @returns {{ data: object[], error: string|null }}
 */
export async function getCandidates(positionId) {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('position_id', positionId)
    .order('id', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

/**
 * Fetch all candidates for every position in an election in a single round-trip.
 * Returns a map: { [positionId]: candidate[] }
 * @param {string[]} positionIds
 * @returns {{ data: Record<string, object[]>, error: string|null }}
 */
export async function getCandidatesForPositions(positionIds) {
  if (!positionIds || positionIds.length === 0) return { data: {}, error: null }

  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .in('position_id', positionIds)
    .order('id', { ascending: true })

  if (error) return { data: {}, error: error.message }

  const grouped = {}
  for (const candidate of (data ?? [])) {
    const pid = candidate.position_id
    if (!grouped[pid]) grouped[pid] = []
    grouped[pid].push(candidate)
  }

  return { data: grouped, error: null }
}

/**
 * Create a candidate.
 * @param {{ positionId: string, name: string, manifesto?: string, photoUrl?: string }} params
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createCandidate({ positionId, name, manifesto, photoUrl }) {
  const { data, error } = await supabase
    .from('candidates')
    .insert({
      position_id: positionId,
      name:        name.trim(),
      manifesto:   manifesto?.trim() || null,
      photo_url:   photoUrl || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

/**
 * Update a candidate.
 * @param {string} candidateId
 * @param {{ name?: string, manifesto?: string, photoUrl?: string }} params
 * @returns {{ error: string|null }}
 */
export async function updateCandidate(candidateId, { name, manifesto, photoUrl }) {
  const updates = {}
  if (name      !== undefined) updates.name      = name.trim()
  if (manifesto !== undefined) updates.manifesto = manifesto?.trim() || null
  if (photoUrl  !== undefined) updates.photo_url = photoUrl || null

  const { error } = await supabase
    .from('candidates')
    .update(updates)
    .eq('id', candidateId)

  return { error: error?.message ?? null }
}

/**
 * Delete a candidate.
 * @param {string} candidateId
 * @returns {{ error: string|null }}
 */
export async function deleteCandidate(candidateId) {
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', candidateId)

  return { error: error?.message ?? null }
}

/**
 * Upload a candidate photo to Supabase Storage.
 * Returns the public URL of the uploaded file.
 * @param {File} file
 * @param {string} bucket  Storage bucket name (default: 'candidate-photos')
 * @returns {{ url: string|null, error: string|null }}
 */
export async function uploadCandidatePhoto(file, bucket = 'candidate-photos') {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `candidates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data?.publicUrl ?? null, error: null }
}