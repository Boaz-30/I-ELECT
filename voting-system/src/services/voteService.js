/**
 * voteService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Supabase calls related to casting and reading votes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabase'

// ─── Cast a vote ─────────────────────────────────────────────────────────────

/**
 * Cast a vote through the cast_vote_secure database RPC.
 * The RPC enforces all business rules server-side:
 *  • election must be active and within start/end time
 *  • candidate must belong to the position
 *  • voter must not have already voted for this position
 *
 * @param {{ electionId: string, positionId: string, candidateId: string }} params
 * @returns {{ success: boolean, alreadyVoted: boolean, error: string|null }}
 */
export async function castVote({ electionId, positionId, candidateId }) {
  const { data, error } = await supabase.rpc('cast_vote_secure', {
    p_election_id:  electionId,
    p_position_id:  positionId,
    p_candidate_id: candidateId,
  })

  if (error) {
    const msg = error.message?.toLowerCase() ?? ''
    const alreadyVoted =
      msg.includes('already voted') ||
      msg.includes('already voted for this position') ||
      error.code === '23505'

    return {
      success:     false,
      alreadyVoted,
      error:       error.message,
    }
  }

  return { success: true, alreadyVoted: false, error: null }
}

// ─── Read this user's votes ───────────────────────────────────────────────────

/**
 * Fetch all positions the current user has already voted in for a given election.
 * Returns a Set of position IDs.
 *
 * Tries voter_id column first (canonical), falls back to user_id if that fails.
 *
 * @param {string} electionId
 * @param {string} userId        The current auth user's UUID
 * @returns {{ votedPositionIds: Set<string>, error: string|null }}
 */
export async function getVotedPositions(electionId, userId) {
  if (!electionId || !userId) return { votedPositionIds: new Set(), error: null }

  // Try voter_id (canonical column name in this project's schema)
  let { data, error } = await supabase
    .from('votes')
    .select('position_id')
    .eq('election_id', electionId)
    .eq('voter_id', userId)

  // If that failed with a column-not-found error, try user_id as fallback
  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const fallback = await supabase
      .from('votes')
      .select('position_id')
      .eq('election_id', electionId)
      .eq('user_id', userId)

    data  = fallback.data
    error = fallback.error
  }

  if (error) {
    console.warn('[voteService] getVotedPositions error:', error.message)
    return { votedPositionIds: new Set(), error: error.message }
  }

  const ids = new Set((data ?? []).map(row => row.position_id).filter(Boolean))
  return { votedPositionIds: ids, error: null }
}

/**
 * Count how many votes the current user has cast in a given election.
 * Uses getVotedPositions internally.
 *
 * @param {string} electionId
 * @param {string} userId
 * @returns {{ count: number, error: string|null }}
 */
export async function getVoteCount(electionId, userId) {
  const { votedPositionIds, error } = await getVotedPositions(electionId, userId)
  return { count: votedPositionIds.size, error }
}

// ─── Admin: total vote counts across all tables ───────────────────────────────

/**
 * Count total votes cast across the whole system.
 * Tries the 'votes' table; falls back to 'ballots' and 'election_votes'
 * for projects that use alternative table names.
 *
 * @returns {{ total: number|null, error: string|null }}
 */
export async function getTotalVoteCount() {
  for (const tableName of ['votes', 'ballots', 'election_votes']) {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (!error && count !== null) {
      return { total: count, error: null }
    }

    // Table does not exist — try next
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      continue
    }

    // Real error (not missing table)
    console.warn(`[voteService] getTotalVoteCount error on table "${tableName}":`, error.message)
  }

  return { total: null, error: 'Could not find votes table. Run supabase_migration.sql first.' }
}

// ─── Admin: participation stats ───────────────────────────────────────────────

/**
 * Compute the overall participation percentage for an election.
 * participationPct = (unique voters / total registered students) * 100
 *
 * Returns null if either count cannot be determined.
 *
 * @param {string} electionId
 * @returns {{ pct: number|null, uniqueVoters: number|null, totalStudents: number|null, error: string|null }}
 */
export async function getParticipation(electionId) {
  const [studentsResult, votersResult] = await Promise.all([
    // Total registered students
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student'),

    // Unique voters in this election (count distinct voter_id)
    supabase
      .from('votes')
      .select('voter_id', { count: 'exact', head: true })
      .eq('election_id', electionId),
  ])

  const totalStudents = studentsResult.error ? null : (studentsResult.count ?? 0)
  const uniqueVoters  = votersResult.error  ? null : (votersResult.count  ?? 0)

  if (totalStudents === null || uniqueVoters === null) {
    return {
      pct: null,
      uniqueVoters,
      totalStudents,
      error: studentsResult.error?.message ?? votersResult.error?.message ?? null,
    }
  }

  const pct = totalStudents > 0
    ? Math.round((uniqueVoters / totalStudents) * 100)
    : 0

  return { pct, uniqueVoters, totalStudents, error: null }
}