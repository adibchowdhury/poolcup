import type { SupabaseClient } from '@supabase/supabase-js'
import { tryCreateNotificationWithPush } from '@/src/lib/push/notify-and-push'

type Agg = {
  points: number
  matches: Set<string>
  poolIds: Set<string>
}

/**
 * After a scoring batch, create one prediction_scored notification per user
 * and call notify_leaderboard_movement for each affected pool.
 * Never throws into scoring callers.
 */
export async function tryNotifyPredictionScoredBatch(
  admin: SupabaseClient,
  matchIds: string[],
  context: string,
): Promise<void> {
  if (matchIds.length === 0) return
  try {
    const { data, error } = await admin
      .from('predictions')
      .select(
        'match_id, points_awarded, pool_id, pool_members!inner(user_id)',
      )
      .in('match_id', matchIds)

    if (error) {
      console.error(`${context}: prediction_scored query failed`, error.message)
      return
    }

    const byUser = new Map<string, Agg>()
    const poolIds = new Set<string>()

    for (const row of data ?? []) {
      const nested = (
        row as {
          pool_members?: { user_id?: string } | { user_id?: string }[]
        }
      ).pool_members
      const userId = Array.isArray(nested)
        ? nested[0]?.user_id
        : nested?.user_id
      if (!userId) continue

      const points = Math.max(0, Number(row.points_awarded) || 0)
      const matchId = String(row.match_id ?? '')
      const poolId = String(row.pool_id ?? '')
      if (poolId) poolIds.add(poolId)

      const agg = byUser.get(userId) ?? {
        points: 0,
        matches: new Set<string>(),
        poolIds: new Set<string>(),
      }
      agg.points += points
      if (matchId) agg.matches.add(matchId)
      if (poolId) agg.poolIds.add(poolId)
      byUser.set(userId, agg)
    }

    await Promise.all(
      [...byUser.entries()].map(async ([userId, agg]) => {
        const matchCount = agg.matches.size
        if (matchCount === 0) return
        const pts = agg.points
        const title =
          pts > 0
            ? 'Your predictions were scored'
            : 'Predictions updated'
        const body =
          pts > 0
            ? `+${pts} pts across ${matchCount} match${matchCount === 1 ? '' : 'es'}`
            : `${matchCount} match${matchCount === 1 ? '' : 'es'} scored`
        await tryCreateNotificationWithPush(
          admin,
          {
            userId,
            category: 'prediction_scored',
            title,
            body,
            data: {
              href: '/dashboard#your-progress',
              points: pts,
              match_count: matchCount,
            },
          },
          context,
        )
      }),
    )

    await Promise.all(
      [...poolIds].map(async (poolId) => {
        const { error: lbError } = await admin.rpc(
          'notify_leaderboard_movement',
          { p_pool_id: poolId },
        )
        if (lbError) {
          console.error(`${context}: notify_leaderboard_movement failed`, {
            poolId,
            message: lbError.message,
          })
        }
      }),
    )
  } catch (err) {
    console.error(`${context}: tryNotifyPredictionScoredBatch threw`, err)
  }
}
