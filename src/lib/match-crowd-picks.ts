import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Refresh consensus cache used by against-crowd badges (bulk, no args).
 * Best-effort — never throw into scoring callers.
 */
export async function tryRefreshMatchCrowdPicks(
  supabase: SupabaseClient,
  context: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('refresh_match_crowd_picks')
    if (error) {
      console.error(`${context}: refresh_match_crowd_picks failed`, {
        message: error.message,
        code: error.code,
      })
    }
  } catch (err) {
    console.error(`${context}: refresh_match_crowd_picks threw`, { err })
  }
}
