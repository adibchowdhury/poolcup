import { NextResponse } from 'next/server'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { knockoutFinalizeFieldsFromScores } from '@/src/lib/match-finalize'
import {
  canFinalizeMatchByKickoff,
  isValidApiFootballFixtureId,
  logUpdaterGuardWarning,
} from '@/src/lib/match-updater-guards'
import { tryPostMatchMoments } from '@/src/lib/post-match-moments'
import { tryNotifyPredictionScoredBatch } from '@/src/lib/notify-scoring-batch'
import { tryAwardPredictionXp } from '@/src/lib/xp'
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
    const { fixtureId, resultTeam1, resultTeam2, advancingTeam } = body as {
      fixtureId?: string
      resultTeam1?: number
      resultTeam2?: number
      advancingTeam?: number | null
    }

    if (!fixtureId || typeof fixtureId !== 'string') {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 }
      )
    }

    if (!isValidApiFootballFixtureId(fixtureId)) {
      return NextResponse.json(
        { error: 'fixtureId is not a valid API-Football fixture id' },
        { status: 400 },
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

    if (
      advancingTeam !== undefined &&
      advancingTeam !== null &&
      advancingTeam !== 1 &&
      advancingTeam !== 2
    ) {
      return NextResponse.json(
        { error: 'advancingTeam must be 1, 2, or omitted' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    const { data: match, error: findError } = await supabase
      .from('matches')
      .select('id, round, kickoff_at, is_final')
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

    if (!canFinalizeMatchByKickoff(match.kickoff_at)) {
      logUpdaterGuardWarning(
        'update-match-result',
        'Refusing early finalize — before minimum kickoff window elapsed',
        {
          matchId: match.id,
          fixtureId,
          kickoffAt: match.kickoff_at,
        },
      )
      return NextResponse.json(
        { error: 'Match cannot be finalized yet — too soon after kickoff' },
        { status: 409 },
      )
    }

    const updatePayload: {
      result_team1: number
      result_team2: number
      is_final: true
      advancing_team?: number
    } = {
      result_team1: resultTeam1,
      result_team2: resultTeam2,
      is_final: true,
    }

    if (isKnockoutRound(match.round)) {
      const knockoutFields = knockoutFinalizeFieldsFromScores(
        match.round,
        resultTeam1,
        resultTeam2,
        advancingTeam,
      )
      if (!knockoutFields) {
        return NextResponse.json(
          {
            error:
              'Knockout matches with a level score require advancingTeam (1 or 2)',
          },
          { status: 400 }
        )
      }
      updatePayload.advancing_team = knockoutFields.advancing_team
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
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

    await tryPostMatchMoments(supabase, match.id, 'update-match-result')
    if (!match.is_final) {
      await tryAwardPredictionXp(supabase, match.id, 'update-match-result')
      await tryNotifyPredictionScoredBatch(
        supabase,
        [match.id],
        'update-match-result'
      )
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
