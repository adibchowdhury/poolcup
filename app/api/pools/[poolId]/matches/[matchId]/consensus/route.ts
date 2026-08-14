import { NextResponse } from 'next/server'
import { parsePoolMatchConsensusPayload } from '@/src/lib/pool-match-consensus'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ poolId: string; matchId: string }>
}

/**
 * Post-lock per-pool match consensus (with counts).
 * Auth + pool membership; no Pro gate. RPC is member-gated in-function.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { poolId: rawPoolId, matchId: rawMatchId } = await context.params
  const poolId = typeof rawPoolId === 'string' ? rawPoolId.trim() : ''
  const matchId = typeof rawMatchId === 'string' ? rawMatchId.trim() : ''
  if (!poolId || !matchId) {
    return NextResponse.json(
      { error: 'invalid_pool_or_match' },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: membership, error: memberError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('pool membership check failed:', memberError.message)
    return NextResponse.json({ error: 'membership_check_failed' }, { status: 500 })
  }
  if (!membership) {
    return NextResponse.json(
      { error: 'not_a_member', locked: true },
      { status: 403 },
    )
  }

  const args = {
    p_user_id: user.id,
    p_pool_id: poolId,
    p_match_id: matchId,
  }

  let { data, error } = await supabase.rpc('get_pool_match_consensus', args)

  if (error) {
    const message = error.message || ''
    if (/not.?a.?member|not_member|forbidden|permission/i.test(message)) {
      return NextResponse.json(
        { error: 'not_a_member', locked: true },
        { status: 403 },
      )
    }
    console.error('get_pool_match_consensus failed:', message)
    const admin = createAdminSupabaseClient()
    const retry = await admin.rpc('get_pool_match_consensus', args)
    if (retry.error) {
      console.error(
        'get_pool_match_consensus admin retry failed:',
        retry.error.message,
      )
      return NextResponse.json(
        { error: retry.error.message },
        { status: 500 },
      )
    }
    data = retry.data
  }

  const payload = parsePoolMatchConsensusPayload(data)
  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_consensus_payload' },
      { status: 500 },
    )
  }

  if (!payload.hasData) {
    return NextResponse.json({
      poolId,
      matchId,
      has_data: false,
      total_predictions: payload.totalPredictions,
      updated_at: payload.updatedAt,
    })
  }

  return NextResponse.json({
    poolId,
    matchId,
    has_data: true,
    total_predictions: payload.totalPredictions,
    updated_at: payload.updatedAt,
    outcome: {
      team1_win_pct: payload.outcome.team1WinPct,
      draw_pct: payload.outcome.drawPct,
      team2_win_pct: payload.outcome.team2WinPct,
    },
    top_scores: payload.topScores.map((s) => ({
      score: s.score,
      count: s.count,
      pct: s.pct,
    })),
  })
}
