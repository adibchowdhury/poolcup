import { NextResponse } from 'next/server'
import {
  HISTORY_PAGE_SIZE,
  coerceHistoryFilterOptions,
  coerceHistoryRow,
  parseHistoryFilters,
  type HistoryFilterOptions,
  type PredictionHistoryRow,
} from '@/src/lib/prediction-history'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Current-user prediction history.
 * List is free; filter query params are honored only when user_has_pro.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = parseHistoryFilters(url.searchParams)

  const { data: isProRaw, error: proError } = await supabase.rpc(
    'user_has_pro',
    { p_user_id: user.id },
  )
  if (proError) {
    console.error('user_has_pro failed:', proError.message)
  }
  const isPro = isProRaw === true

  const limit = HISTORY_PAGE_SIZE
  const offset = (parsed.page - 1) * limit

  const rpcArgs: Record<string, unknown> = {
    p_user_id: user.id,
    p_limit: limit,
    p_offset: offset,
    p_sport: null,
    p_event_id: null,
    p_pool_id: null,
    p_result_filter: null,
    p_date_from: null,
    p_date_to: null,
    p_search: null,
  }

  if (isPro) {
    rpcArgs.p_sport = parsed.sport
    rpcArgs.p_event_id = parsed.eventId
    rpcArgs.p_pool_id = parsed.poolId
    rpcArgs.p_result_filter = parsed.result
    rpcArgs.p_date_from = parsed.dateFrom
      ? new Date(`${parsed.dateFrom}T00:00:00.000Z`).toISOString()
      : null
    rpcArgs.p_date_to = parsed.dateTo
      ? new Date(`${parsed.dateTo}T23:59:59.999Z`).toISOString()
      : null
    rpcArgs.p_search = parsed.q
  }

  let data: unknown = null
  const { data: userData, error } = await supabase.rpc(
    'get_prediction_history',
    rpcArgs,
  )

  if (error) {
    console.error('get_prediction_history failed:', error.message)
    const admin = createAdminSupabaseClient()
    const retry = await admin.rpc('get_prediction_history', rpcArgs)
    if (retry.error) {
      return NextResponse.json(
        { error: retry.error.message },
        { status: 500 },
      )
    }
    data = retry.data
  } else {
    data = userData
  }

  const rows = (Array.isArray(data) ? data : [])
    .map(coerceHistoryRow)
    .filter((row): row is PredictionHistoryRow => row != null)

  const totalCount = rows[0]?.total_count ?? 0

  let filterOptions: HistoryFilterOptions | null = null
  if (isPro) {
    filterOptions = await loadFilterOptions(supabase, user.id)
  }

  return NextResponse.json({
    rows,
    totalCount,
    pageSize: HISTORY_PAGE_SIZE,
    isPro,
    filtersApplied: isPro,
    filterOptions,
  })
}

/** Complete distinct sports/events/pools via RPC (no capped prediction scan). */
async function loadFilterOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<HistoryFilterOptions> {
  const empty: HistoryFilterOptions = { sports: [], events: [], pools: [] }
  const args = { p_user_id: userId }

  const { data, error } = await supabase.rpc(
    'get_prediction_history_filter_options',
    args,
  )
  if (!error) {
    return coerceHistoryFilterOptions(data)
  }

  console.error(
    'get_prediction_history_filter_options failed:',
    error.message,
  )
  const admin = createAdminSupabaseClient()
  const retry = await admin.rpc('get_prediction_history_filter_options', args)
  if (retry.error) {
    console.error(
      'get_prediction_history_filter_options admin retry failed:',
      retry.error.message,
    )
    return empty
  }
  return coerceHistoryFilterOptions(retry.data)
}
