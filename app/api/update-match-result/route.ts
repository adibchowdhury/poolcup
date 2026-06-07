import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { secureCompare } from '@/src/lib/secure-compare'

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('update-match-result: CRON_SECRET is not configured')
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null
    if (!bearerToken || !secureCompare(bearerToken, cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fixtureId, resultTeam1, resultTeam2 } = body as {
      fixtureId?: string
      resultTeam1?: number
      resultTeam2?: number
    }

    if (!fixtureId || typeof fixtureId !== 'string') {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 }
      )
    }

    if (
      typeof resultTeam1 !== 'number' ||
      typeof resultTeam2 !== 'number' ||
      !Number.isInteger(resultTeam1) ||
      !Number.isInteger(resultTeam2) ||
      resultTeam1 < 0 ||
      resultTeam2 < 0
    ) {
      return NextResponse.json(
        {
          error:
            'resultTeam1 and resultTeam2 must be non-negative integers',
        },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: match, error: findError } = await supabase
      .from('matches')
      .select('id')
      .eq('fixture_id', fixtureId)
      .maybeSingle()

    if (findError) {
      console.error('update-match-result: failed to find match', {
        fixtureId,
        error: findError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        result_team1: resultTeam1,
        result_team2: resultTeam2,
        is_final: true,
      })
      .eq('id', match.id)

    if (updateError) {
      console.error('update-match-result: failed to update match', {
        fixtureId,
        matchId: match.id,
        error: updateError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: rpcError } = await supabase.rpc('calculate_match_points', {
      p_match_id: match.id,
    })

    if (rpcError) {
      console.error('update-match-result: calculate_match_points failed', {
        fixtureId,
        matchId: match.id,
        error: rpcError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, matchId: match.id })
  } catch (error) {
    console.error('update-match-result error:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
