import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    .select('display_name, points, avatar')
    .eq('id', user.id)
    .maybeSingle()

  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('user_id', user.id)

  if (memberError) {
    console.error('Failed to fetch pool memberships:', memberError.message)
  }

  const memberIds = (memberships ?? []).map((row) => row.id)

  const predictionsByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('member_id, match_id')
      .in('member_id', memberIds)

    const distinctByMember = new Map<string, Set<string>>()
    for (const row of predictions ?? []) {
      if (!distinctByMember.has(row.member_id)) {
        distinctByMember.set(row.member_id, new Set())
      }
      distinctByMember.get(row.member_id)!.add(row.match_id)
    }
    for (const [memberId, matchIds] of distinctByMember) {
      predictionsByMember.set(memberId, matchIds.size)
    }
  }

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

  let predictionsMade = 0
  let totalCorrect = 0
  for (const memberId of memberIds) {
    predictionsMade += predictionsByMember.get(memberId) ?? 0
    totalCorrect += correctByMember.get(memberId) ?? 0
  }

  const winRate =
    predictionsMade > 0
      ? Math.round((totalCorrect / predictionsMade) * 100)
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
