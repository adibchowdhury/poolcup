import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { fixtureId, resultTeam1, resultTeam2, apiSecret } = body as {
      fixtureId?: string
      resultTeam1?: number
      resultTeam2?: number
      apiSecret?: string
    }

    if (!apiSecret || apiSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      console.error('update-match-result find error:', findError.message)
      return NextResponse.json({ error: findError.message }, { status: 500 })
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
      console.error('update-match-result update error:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: rpcError } = await supabase.rpc('calculate_match_points', {
      p_match_id: match.id,
    })

    if (rpcError) {
      console.error(
        'update-match-result calculate_match_points error:',
        rpcError.message
      )
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, matchId: match.id })
  } catch (error) {
    console.error('update-match-result error:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
