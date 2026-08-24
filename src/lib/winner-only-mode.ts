import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Legacy Winner Only pools (World Cup group-standings flow) store picks in
 * group_predictions / third_place_rankings. New per-match Winner Only pools
 * use the predictions table only.
 */
export async function poolHasLegacyWinnerData(
  supabase: SupabaseClient,
  poolId: string,
): Promise<boolean> {
  const [groupResult, thirdResult] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId),
    supabase
      .from('third_place_rankings')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId),
  ])

  if (groupResult.error) {
    console.error(
      'poolHasLegacyWinnerData: group_predictions check failed',
      groupResult.error.message,
    )
  }
  if (thirdResult.error) {
    console.error(
      'poolHasLegacyWinnerData: third_place_rankings check failed',
      thirdResult.error.message,
    )
  }

  return (groupResult.count ?? 0) > 0 || (thirdResult.count ?? 0) > 0
}

export function isLegacyWinnerOnlyPool(
  scoringStyle: string,
  hasLegacyWinnerData: boolean,
): boolean {
  return scoringStyle === 'winner' && hasLegacyWinnerData
}

export function isPerMatchWinnerOnlyPool(
  scoringStyle: string,
  hasLegacyWinnerData: boolean,
): boolean {
  return scoringStyle === 'winner' && !hasLegacyWinnerData
}
