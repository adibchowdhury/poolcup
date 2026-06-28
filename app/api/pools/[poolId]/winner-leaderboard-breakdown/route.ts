import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import {
  buildWinnerLeaderboardBreakdownByMember,
  serializeWinnerLeaderboardBreakdown,
} from '@/src/lib/winner-leaderboard-breakdown'

const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final'] as const

export async function GET(
  _request: Request,
  context: { params: Promise<{ poolId: string }> },
) {
  try {
    const { poolId } = await context.params

    if (!poolId) {
      return NextResponse.json({ error: 'poolId is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error(
        'winner-leaderboard-breakdown: membership check failed',
        membershipError,
      )
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('scoring_style')
      .eq('id', poolId)
      .maybeSingle()

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.scoring_style !== 'winner') {
      return NextResponse.json({ error: 'Not a winner pool' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    const [
      membersResult,
      groupResult,
      thirdPlaceResult,
      knockoutResult,
    ] = await Promise.all([
      admin.from('pool_members').select('id, user_id').eq('pool_id', poolId),
      admin
        .from('group_predictions')
        .select('member_id, group_name, points_awarded')
        .eq('pool_id', poolId)
        .gt('points_awarded', 0),
      admin
        .from('third_place_rankings')
        .select('user_id, points_awarded')
        .eq('pool_id', poolId)
        .gt('points_awarded', 0),
      admin
        .from('predictions')
        .select(
          `
          member_id,
          match_id,
          pred_team1,
          pred_team2,
          points_awarded,
          matches!inner (
            team1_name,
            team2_name,
            result_team1,
            result_team2,
            round,
            group_name,
            kickoff_at,
            is_final
          )
        `,
        )
        .eq('pool_id', poolId)
        .gt('points_awarded', 0)
        .in('matches.round', [...KNOCKOUT_ROUNDS])
        .eq('matches.is_final', true),
    ])

    if (membersResult.error) {
      console.error(
        'winner-leaderboard-breakdown: members load failed',
        membersResult.error,
      )
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (groupResult.error) {
      console.error(
        'winner-leaderboard-breakdown: group_predictions load failed',
        groupResult.error,
      )
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (thirdPlaceResult.error) {
      console.error(
        'winner-leaderboard-breakdown: third_place_rankings load failed',
        thirdPlaceResult.error,
      )
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (knockoutResult.error) {
      console.error(
        'winner-leaderboard-breakdown: predictions load failed',
        knockoutResult.error,
      )
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const userIdToMemberId = new Map(
      (membersResult.data ?? []).map((row) => [row.user_id, row.id]),
    )

    const breakdownByMember = buildWinnerLeaderboardBreakdownByMember({
      groupRows: groupResult.data ?? [],
      thirdPlaceRows: thirdPlaceResult.data ?? [],
      knockoutRows: knockoutResult.data ?? [],
      userIdToMemberId,
    })

    return NextResponse.json({
      breakdownByMember: serializeWinnerLeaderboardBreakdown(breakdownByMember),
    })
  } catch (error) {
    console.error('winner-leaderboard-breakdown: unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
