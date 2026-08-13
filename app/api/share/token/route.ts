import { NextResponse } from 'next/server'
import {
  buildSignedShareImagePath,
  type ShareTokenPayload,
  type ShareTokenType,
} from '@/src/lib/share-token'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { isMatchLocked } from '@/src/lib/match-lock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  type?: ShareTokenType
  poolId?: string
  matchId?: string
}

/**
 * Mint a signed share-card image URL for the authenticated user's own data.
 * Clients embed the returned imageUrl (includes ?t=) in share / OG links.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const type = body.type
  const poolId = body.poolId?.trim()
  const matchId = body.matchId?.trim()

  if (type !== 'prediction' && type !== 'leaderboard') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }
  if (type === 'prediction' && !matchId) {
    return NextResponse.json({ error: 'matchId_required' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
  }

  if (type === 'prediction' && matchId) {
    const { data: match } = await supabase
      .from('matches')
      .select('id, locked_at, is_final')
      .eq('id', matchId)
      .maybeSingle()

    if (!match) {
      return NextResponse.json({ error: 'match_not_found' }, { status: 404 })
    }

    const lockedOrFinal =
      Boolean(match.is_final) || isMatchLocked(match.locked_at ?? null)
    if (!lockedOrFinal) {
      return NextResponse.json(
        { error: 'match_not_locked' },
        { status: 403 },
      )
    }
  }

  const payload: ShareTokenPayload =
    type === 'prediction'
      ? { type, userId: user.id, poolId, matchId }
      : { type, userId: user.id, poolId }

  try {
    const imageUrl = buildSignedShareImagePath(payload)
    return NextResponse.json({
      imageUrl,
      userId: user.id,
      type,
      poolId,
      matchId: matchId ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'share_token_misconfigured' },
      { status: 500 },
    )
  }
}
