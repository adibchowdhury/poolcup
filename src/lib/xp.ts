import type { SupabaseClient } from '@supabase/supabase-js'
import { levelFromXp } from '@/src/lib/levels'

export const XP_ACTION_AMOUNTS = {
  prediction_made: 5,
  prediction_correct: 15,
  prediction_exact: 40,
  prediction_draw: 20,
  pool_join: 10,
  pool_create: 20,
  invite_accepted: 15,
  friend_added: 10,
  pool_chat_first: 5,
  daily_active: 5,
  onboarding_complete: 25,
} as const

export type XpActionSourceType = keyof typeof XP_ACTION_AMOUNTS

export const ACHIEVEMENT_XP_SOURCE = 'achievement' as const

export type XpAwardResult = {
  awarded: number
  sourceType: string
  sourceId: string
  levelBefore: number
  levelAfter: number
  highestLevel: number
  alreadyHad: boolean
}

export function utcDateStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function friendshipXpSourceId(userA: string, userB: string): string {
  return [userA, userB].sort().join(':')
}

export async function fetchUserXpTotal(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!userId) return 0
  const { data, error } = await supabase.rpc('get_user_xp_total', {
    p_user_id: userId,
  })
  if (error) {
    console.error('get_user_xp_total failed:', error.message)
    return 0
  }
  return Math.max(0, Number(data) || 0)
}

export async function refreshHighestLevel(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const total = await fetchUserXpTotal(supabase, userId)
  const level = levelFromXp(total)

  const { data: row } = await supabase
    .from('users')
    .select('highest_level')
    .eq('id', userId)
    .maybeSingle()

  const current = Math.max(1, Number(row?.highest_level) || 1)
  const next = Math.max(current, level)
  if (next > current) {
    await supabase.from('users').update({ highest_level: next }).eq('id', userId)
  }
  return next
}

export async function awardXpAdmin(
  supabase: SupabaseClient,
  params: {
    userId: string
    amount: number
    sourceType: string
    sourceId: string
    description: string
  },
): Promise<number> {
  const { data, error } = await supabase.rpc('award_xp', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_source_type: params.sourceType,
    p_source_id: params.sourceId,
    p_description: params.description,
  })
  if (error) {
    console.error('award_xp failed:', error.message, params)
    return 0
  }
  return Math.max(0, Number(data) || 0)
}

/**
 * Best-effort prediction XP after a newly-final match is scored.
 * Must never throw into scoring callers. award_prediction_xp is idempotent.
 */
export async function tryAwardPredictionXp(
  supabase: SupabaseClient,
  matchId: string,
  context: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('award_prediction_xp', {
      p_match_id: matchId,
    })
    if (error) {
      console.error(`${context}: award_prediction_xp failed`, {
        matchId,
        message: error.message,
        code: error.code,
      })
      return
    }

    const { data: members, error: membersError } = await supabase
      .from('predictions')
      .select('pool_members!inner(user_id)')
      .eq('match_id', matchId)

    if (membersError) {
      console.error(`${context}: highest_level lookup failed`, {
        matchId,
        message: membersError.message,
      })
      return
    }

    const userIds = new Set<string>()
    for (const row of members ?? []) {
      const nested = (row as { pool_members?: { user_id?: string } | { user_id?: string }[] })
        .pool_members
      const id = Array.isArray(nested) ? nested[0]?.user_id : nested?.user_id
      if (id) userIds.add(id)
    }

    await Promise.all(
      [...userIds].map((userId) => refreshHighestLevel(supabase, userId)),
    )
  } catch (err) {
    console.error(`${context}: award_prediction_xp threw`, { matchId, err })
  }
}
