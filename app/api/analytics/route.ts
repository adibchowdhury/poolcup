import { NextResponse } from 'next/server'
import {
  analyticsRangeToBounds,
  coerceAnalyticsBestRank,
  coerceAnalyticsComparisons,
  coerceAnalyticsTimeseries,
  coerceUserAnalytics,
  parseAnalyticsRange,
} from '@/src/lib/analytics'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Advanced Analytics payload for the authenticated user.
 * Phase 2: no Pro gate — available to all signed-in users.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const userId = user.id

  const url = new URL(request.url)
  const range = parseAnalyticsRange(url.searchParams.get('range'))
  const { dateFrom, dateTo, seasonOnly } = analyticsRangeToBounds(range)

  const analyticsArgs = {
    p_user_id: userId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_season_only: seasonOnly,
  }
  const userOnly = { p_user_id: userId }

  const [analytics, comparisons, timeseries, rank] = await Promise.all([
    callRpc(supabase, 'get_user_analytics', analyticsArgs),
    callRpc(supabase, 'get_user_analytics_comparisons', userOnly),
    callRpc(supabase, 'get_user_analytics_timeseries', analyticsArgs),
    callRpc(supabase, 'get_user_best_rank', userOnly),
  ])

  if (
    analytics.error ||
    comparisons.error ||
    timeseries.error ||
    rank.error
  ) {
    const message =
      analytics.error ||
      comparisons.error ||
      timeseries.error ||
      rank.error ||
      'Failed to load analytics'
    return NextResponse.json({ error: message, isPro: true }, { status: 500 })
  }

  return NextResponse.json({
    isPro: true,
    range,
    dateFrom,
    dateTo,
    seasonOnly,
    analytics: coerceUserAnalytics(analytics.data),
    comparisons: coerceAnalyticsComparisons(comparisons.data),
    timeseries: coerceAnalyticsTimeseries(timeseries.data),
    rank: coerceAnalyticsBestRank(rank.data),
  })
}

async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, args)
  if (!error) return { data, error: null }

  console.error(`${fn} failed:`, error.message)
  const admin = createAdminSupabaseClient()
  const retry = await admin.rpc(fn, args)
  if (retry.error) {
    console.error(`${fn} admin retry failed:`, retry.error.message)
    return { data: null, error: retry.error.message }
  }
  return { data: retry.data, error: null }
}
