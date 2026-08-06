import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Best-effort match-moment posts for pool chat.
 * Must never throw into scoring callers — failures are logged only.
 */
export async function tryPostMatchMoments(
  supabase: SupabaseClient,
  matchId: string,
  context: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('post_match_moments', {
      p_match_id: matchId,
    })
    if (error) {
      console.error(`${context}: post_match_moments failed`, {
        matchId,
        message: error.message,
        code: error.code,
      })
    }
  } catch (err) {
    console.error(`${context}: post_match_moments threw`, { matchId, err })
  }
}
