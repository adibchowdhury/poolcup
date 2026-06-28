import type { SupabaseClient } from '@supabase/supabase-js'

export const THIRD_PLACE_DEADLINE_LABEL = 'Sat, Jun 27'

export type WinnerPoolNeedingThirdPlace = {
  poolId: string
  inviteCode: string
  poolName: string
}

type MembershipRow = {
  pool_id: string
  pools:
    | {
        id: string
        invite_code: string
        name: string
        scoring_style: string
      }
    | {
        id: string
        invite_code: string
        name: string
        scoring_style: string
      }[]
    | null
}

export async function fetchWinnerPoolsNeedingThirdPlace(
  supabase: SupabaseClient,
  userId: string,
): Promise<WinnerPoolNeedingThirdPlace[]> {
  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select(
      `
      pool_id,
      pools (
        id,
        invite_code,
        name,
        scoring_style
      )
    `,
    )
    .eq('user_id', userId)

  if (memberError) {
    console.error(
      'Failed to load pools for third-place deadline banner:',
      memberError.message,
    )
    return []
  }

  const winnerPools: WinnerPoolNeedingThirdPlace[] = []

  for (const row of (memberships ?? []) as unknown as MembershipRow[]) {
    const poolRaw = row.pools
    const pool = Array.isArray(poolRaw) ? poolRaw[0] : poolRaw
    if (!pool || pool.scoring_style !== 'winner') continue

    winnerPools.push({
      poolId: pool.id,
      inviteCode: pool.invite_code,
      poolName: pool.name,
    })
  }

  if (winnerPools.length === 0) {
    return []
  }

  const poolIds = winnerPools.map((pool) => pool.poolId)
  const { data: thirdPlaceRows, error: thirdPlaceError } = await supabase
    .from('third_place_rankings')
    .select('pool_id')
    .in('pool_id', poolIds)
    .eq('user_id', userId)

  if (thirdPlaceError) {
    console.error(
      'Failed to load third-place rankings for deadline banner:',
      thirdPlaceError.message,
    )
    return []
  }

  const rankedPoolIds = new Set(
    (thirdPlaceRows ?? []).map((row) => row.pool_id as string),
  )

  return winnerPools
    .filter((pool) => !rankedPoolIds.has(pool.poolId))
    .sort((a, b) => a.poolName.localeCompare(b.poolName, undefined, { sensitivity: 'base' }))
}

export function resolveThirdPlaceDeadlineHref(
  pools: WinnerPoolNeedingThirdPlace[],
): string | null {
  if (pools.length === 0) return null
  return `/pool/${pools[0]!.inviteCode}?tab=predictions`
}
