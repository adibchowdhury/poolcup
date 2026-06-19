import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { resolveUserDisplayName } from '@/src/lib/auth'
import {
  fetchMemberPredictionCounts,
  sumMemberCounts,
} from '@/src/lib/member-prediction-counts'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type MembershipRow = {
  id: string
  pools: { scoring_style: string } | { scoring_style: string }[] | null
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>
}) {
  const { passwordReset } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, points, avatar, support_prompt_last_shown_at')
    .eq('id', user.id)
    .maybeSingle()

  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select('id, pools(scoring_style)')
    .eq('user_id', user.id)

  if (memberError) {
    console.error('Failed to fetch pool memberships:', memberError.message)
  }

  const memberRows = (memberships ?? []) as MembershipRow[]
  const memberContexts = memberRows.flatMap((row) => {
    const poolRaw = row.pools
    const pool = Array.isArray(poolRaw) ? poolRaw[0] : poolRaw
    if (!pool) return []
    return [{ memberId: row.id, scoringStyle: pool.scoring_style }]
  })
  const memberIds = memberContexts.map((row) => row.memberId)

  const { predictionsByMember, classicMatchPredictionsByMember } =
    await fetchMemberPredictionCounts(supabase, memberContexts)

  const correctByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: cacheRows } = await supabase
      .from('leaderboard_cache')
      .select('member_id, correct_winners')
      .in('member_id', memberIds)

    for (const row of cacheRows ?? []) {
      correctByMember.set(row.member_id, row.correct_winners ?? 0)
    }
  }

  const predictionsMade = sumMemberCounts(memberIds, predictionsByMember)
  const classicMatchPredictionsMade = sumMemberCounts(
    memberIds,
    classicMatchPredictionsByMember,
  )
  const totalCorrect = sumMemberCounts(memberIds, correctByMember)

  const winRate =
    classicMatchPredictionsMade > 0
      ? Math.round((totalCorrect / classicMatchPredictionsMade) * 100)
      : null

  return (
    <DashboardView
      userId={user.id}
      email={user.email ?? ''}
      displayName={resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata,
      )}
      avatar={profile?.avatar ?? null}
      supportPromptLastShownAt={profile?.support_prompt_last_shown_at ?? null}
      quickStats={{
        totalPoints: profile?.points ?? 0,
        predictionsMade,
        winRate,
      }}
      passwordResetSuccess={passwordReset === 'success'}
      errorMessage={null}
    />
  )
}
