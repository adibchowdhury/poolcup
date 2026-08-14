import { NextResponse } from 'next/server'
import {
  coerceHistoricalAllTime,
  coerceHistoricalBySeason,
  coerceHistoricalByYear,
  coerceHistoricalRankBySeason,
} from '@/src/lib/historical-performance'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Pro Historical Performance payload.
 * Whole page is Pro-gated (user_has_pro); non-Pro get 403 + no data.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: isProRaw, error: proError } = await supabase.rpc(
    'user_has_pro',
    { p_user_id: user.id },
  )
  if (proError) {
    console.error('user_has_pro failed:', proError.message)
  }
  const isPro = isProRaw === true

  if (!isPro) {
    return NextResponse.json(
      {
        error: 'pro_required',
        isPro: false,
        locked: true,
      },
      { status: 403 },
    )
  }

  const args = { p_user_id: user.id }

  const [bySeasonRaw, byYearRaw, allTimeRaw, rankRaw] = await Promise.all([
    callRpc(supabase, 'get_historical_by_season', args),
    callRpc(supabase, 'get_historical_by_year', args),
    callRpc(supabase, 'get_historical_all_time', args),
    callRpc(supabase, 'get_historical_rank_by_season', args),
  ])

  if (
    bySeasonRaw.error ||
    byYearRaw.error ||
    allTimeRaw.error ||
    rankRaw.error
  ) {
    const message =
      bySeasonRaw.error ||
      byYearRaw.error ||
      allTimeRaw.error ||
      rankRaw.error ||
      'Failed to load historical performance'
    return NextResponse.json({ error: message, isPro: true }, { status: 500 })
  }

  const ranks = coerceHistoricalRankBySeason(rankRaw.data)
  const bySeason = coerceHistoricalBySeason(bySeasonRaw.data, ranks)
  const byYear = coerceHistoricalByYear(byYearRaw.data)
  const allTime = coerceHistoricalAllTime(allTimeRaw.data)

  return NextResponse.json({
    isPro: true,
    allTime,
    bySeason,
    byYear,
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
