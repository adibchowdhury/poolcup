import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { tryCreateNotificationWithPush } from '@/src/lib/push/notify-and-push'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const REMINDER_HORIZON_MS = 24 * 60 * 60 * 1000
const DEDUPE_LOOKBACK_MS = 48 * 60 * 60 * 1000

type MatchRow = {
  id: string
  event_id: string | null
  locked_at: string
}

type PoolRow = {
  id: string
  event_id: string | null
  invite_code: string | null
}

function asMatchIds(data: unknown): string[] {
  if (!data || typeof data !== 'object') return []
  const matchIds = (data as { match_ids?: unknown }).match_ids
  if (!Array.isArray(matchIds)) return []
  return matchIds.map((id) => String(id)).filter(Boolean)
}

async function handlePushMatchReminders(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()

  try {
    const summary = await withSyncJob(
      admin,
      { jobType: 'push_match_reminders' },
      async () => {
        const now = Date.now()
        const nowIso = new Date(now).toISOString()
        const horizonIso = new Date(now + REMINDER_HORIZON_MS).toISOString()
        const lookbackIso = new Date(now - DEDUPE_LOOKBACK_MS).toISOString()

        const { data: matches, error: matchError } = await admin
          .from('matches')
          .select('id, event_id, locked_at')
          .eq('is_final', false)
          .gt('locked_at', nowIso)
          .lte('locked_at', horizonIso)

        if (matchError) throw new Error(matchError.message)

        const upcoming = (matches ?? []) as MatchRow[]
        const byEvent = new Map<string, MatchRow[]>()
        for (const match of upcoming) {
          if (!match.event_id) continue
          const list = byEvent.get(match.event_id) ?? []
          list.push(match)
          byEvent.set(match.event_id, list)
        }

        if (byEvent.size === 0) {
          return {
            itemsProcessed: 0,
            itemsChanged: 0,
            detail: { usersNotified: 0, matchesConsidered: upcoming.length },
            result: { usersNotified: 0, matchesConsidered: upcoming.length },
          }
        }

        const eventIds = [...byEvent.keys()]
        const { data: pools, error: poolsError } = await admin
          .from('pools')
          .select('id, event_id, invite_code')
          .in('event_id', eventIds)

        if (poolsError) throw new Error(poolsError.message)

        const poolList = (pools ?? []) as PoolRow[]
        const poolIds = poolList.map((p) => p.id)
        if (poolIds.length === 0) {
          return {
            itemsProcessed: upcoming.length,
            itemsChanged: 0,
            detail: { usersNotified: 0 },
            result: { usersNotified: 0, matchesConsidered: upcoming.length },
          }
        }

        const { data: memberRows, error: memberRowsError } = await admin
          .from('pool_members')
          .select('id, user_id, pool_id')
          .in('pool_id', poolIds)

        if (memberRowsError) throw new Error(memberRowsError.message)

        const { data: existingNotifs, error: notifError } = await admin
          .from('notifications')
          .select('user_id, data')
          .eq('category', 'match_reminder')
          .gte('created_at', lookbackIso)

        if (notifError) throw new Error(notifError.message)

        const alreadyReminded = new Map<string, Set<string>>()
        for (const row of existingNotifs ?? []) {
          const userId = String(row.user_id ?? '')
          if (!userId) continue
          const set = alreadyReminded.get(userId) ?? new Set<string>()
          for (const id of asMatchIds(row.data)) set.add(id)
          alreadyReminded.set(userId, set)
        }

        const poolsById = new Map(poolList.map((p) => [p.id, p]))

        type Agg = { matchIds: Set<string>; href: string }
        const byUser = new Map<string, Agg>()

        for (const member of memberRows ?? []) {
          const userId = member.user_id as string
          const poolId = member.pool_id as string
          const memberId = member.id as string
          const pool = poolsById.get(poolId)
          if (!userId || !pool?.event_id) continue

          const eventMatches = byEvent.get(pool.event_id) ?? []
          if (eventMatches.length === 0) continue

          const matchIds = eventMatches.map((m) => m.id)
          const { data: preds } = await admin
            .from('predictions')
            .select('match_id')
            .eq('pool_id', poolId)
            .eq('member_id', memberId)
            .in('match_id', matchIds)

          const predicted = new Set(
            (preds ?? []).map((p) => String(p.match_id)),
          )
          const reminded = alreadyReminded.get(userId) ?? new Set<string>()
          const missing = matchIds.filter(
            (id) => !predicted.has(id) && !reminded.has(id),
          )
          if (missing.length === 0) continue

          const agg = byUser.get(userId) ?? {
            matchIds: new Set<string>(),
            href: `/pool/${pool.invite_code || poolId}`,
          }
          for (const id of missing) agg.matchIds.add(id)
          if (pool.invite_code) agg.href = `/pool/${pool.invite_code}`
          byUser.set(userId, agg)
        }

        let usersNotified = 0
        for (const [userId, agg] of byUser.entries()) {
          const count = agg.matchIds.size
          if (count === 0) continue
          const matchIdList = [...agg.matchIds]
          const id = await tryCreateNotificationWithPush(
            admin,
            {
              userId,
              category: 'match_reminder',
              title:
                count === 1
                  ? 'A match is locking soon'
                  : 'Matches locking soon',
              body:
                count === 1
                  ? 'You have 1 unpredicted match locking within 24 hours.'
                  : `You have ${count} unpredicted matches locking within 24 hours.`,
              data: {
                href: agg.href,
                match_ids: matchIdList,
              },
            },
            'push-match-reminders',
          )
          if (id) {
            usersNotified += 1
            const set = alreadyReminded.get(userId) ?? new Set<string>()
            for (const mid of matchIdList) set.add(mid)
            alreadyReminded.set(userId, set)
          }
        }

        return {
          itemsProcessed: upcoming.length,
          itemsChanged: usersNotified,
          detail: {
            usersNotified,
            matchesConsidered: upcoming.length,
            events: eventIds.length,
          },
          result: {
            usersNotified,
            matchesConsidered: upcoming.length,
          },
        }
      },
    )

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('push-match-reminders error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handlePushMatchReminders(request)
}

export async function POST(request: Request) {
  return handlePushMatchReminders(request)
}
