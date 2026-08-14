import { NextResponse } from 'next/server'
import { parseMatchConsensusPayload } from '@/src/lib/match-consensus'
import { isMatchLocked } from '@/src/lib/match-lock'
import { userHasPro } from '@/src/lib/require-pro'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ matchId: string }>
}

/**
 * Crowd Win Chance / match consensus.
 * Auth required always.
 * Pre-lock → Pro required (403 for free).
 * Post-lock → any authed user (restores free curiosity view).
 * Lock check mirrors app: isMatchLocked(matches.locked_at).
 * Assumes get_match_consensus no longer hard-raises pro_required (API gates).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { matchId: rawMatchId } = await context.params
  const matchId = typeof rawMatchId === 'string' ? rawMatchId.trim() : ''
  if (!matchId) {
    return NextResponse.json({ error: 'invalid_match_id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('id, locked_at')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) {
    console.error('consensus match lookup failed:', matchError.message)
    return NextResponse.json({ error: 'match_lookup_failed' }, { status: 500 })
  }
  if (!matchRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const matchLocked = isMatchLocked(
    (matchRow.locked_at as string | null) ?? null,
  )

  const isPro = await userHasPro(supabase, user.id)

  // Pre-lock advantage: Pro only. Post-lock: any authed user.
  if (!matchLocked && !isPro) {
    return NextResponse.json(
      {
        error: 'pro_required',
        isPro: false,
        match_locked: false,
        feature_locked: true,
      },
      { status: 403 },
    )
  }

  const args = { p_user_id: user.id, p_match_id: matchId }
  let { data, error } = await supabase.rpc('get_match_consensus', args)

  if (error) {
    const message = error.message || ''
    // Transitional: RPC may still raise pro_required until MCP update.
    if (/pro_required/i.test(message)) {
      if (matchLocked) {
        console.error(
          'get_match_consensus raised pro_required post-lock — update RPC to remove hard Pro gate',
        )
      }
      return NextResponse.json(
        {
          error: 'pro_required',
          isPro: false,
          match_locked: matchLocked,
          feature_locked: true,
        },
        { status: 403 },
      )
    }
    console.error('get_match_consensus failed:', message)
    const admin = createAdminSupabaseClient()
    const retry = await admin.rpc('get_match_consensus', args)
    if (retry.error) {
      console.error(
        'get_match_consensus admin retry failed:',
        retry.error.message,
      )
      return NextResponse.json(
        { error: retry.error.message, isPro, match_locked: matchLocked },
        { status: 500 },
      )
    }
    data = retry.data
  }

  const payload = parseMatchConsensusPayload(data)
  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_consensus_payload', isPro, match_locked: matchLocked },
      { status: 500 },
    )
  }

  if (!payload.hasData) {
    return NextResponse.json({
      isPro,
      matchId,
      match_locked: matchLocked,
      has_data: false,
      updated_at: payload.updatedAt,
    })
  }

  return NextResponse.json({
    isPro,
    matchId,
    match_locked: matchLocked,
    has_data: true,
    updated_at: payload.updatedAt,
    outcome: {
      team1_win_pct: payload.outcome.team1WinPct,
      draw_pct: payload.outcome.drawPct,
      team2_win_pct: payload.outcome.team2WinPct,
    },
    top_scores: payload.topScores.map((s) => ({
      score: s.score,
      pct: s.pct,
    })),
  })
}
