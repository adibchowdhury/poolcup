'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import {
  PoolHomeView,
  type PoolHomeMeta,
} from '@/components/pool/pool-home-view'
import { PoolPageSkeleton } from '@/components/pool/pool-page-skeleton'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import type { WinnerGroupPrediction } from '@/components/pool/your-predictions-section'
import {
  parseStandingsJson,
  parseThirdPlaceRankingsJson,
} from '@/src/lib/world-cup-groups'
import { deriveCurrentTournamentStage } from '@/src/lib/tournament-round-labels'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'
import { buildPoolLeaderboardMembers } from '@/src/lib/pool-leaderboard'

type Pool = {
  id: string
  name: string
  invite_code: string
  creator_id: string
  scoring_style: string
}

type PoolMember = {
  id: string
  user_id: string
  display_name: string
  joined_at: string
}

type MatchForPrediction = {
  id: string
  kickoff_at: string
  round: string
  group_name: string | null
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
}

type PredictionWithMatch = {
  match_id: string
  pred_team1: number
  pred_team2: number
  matches: MatchForPrediction | MatchForPrediction[] | null
}

function formatTimeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Soon'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function PoolPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [poolMeta, setPoolMeta] = useState<PoolHomeMeta | null>(null)
  const [members, setMembers] = useState<LeaderboardMember[]>([])
  const [userPredictions, setUserPredictions] = useState<UserPoolPrediction[]>([])
  const [winnerGroups, setWinnerGroups] = useState<WinnerGroupPrediction[]>([])
  const [thirdPlaceTeams, setThirdPlaceTeams] = useState<string[]>([])
  const [hasPredictions, setHasPredictions] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [poolId, setPoolId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [canDelete, setCanDelete] = useState(false)
  const [avatarByMemberId, setAvatarByMemberId] = useState(
    () => new Map<string, string | null>(),
  )

  const loadPoolData = useCallback(async () => {
    if (!userId) return

    setPageLoading(true)
    setLeaderboardLoading(true)
    setNotFound(false)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code, creator_id, scoring_style')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (poolError || !poolData) {
      setPoolMeta(null)
      setMembers([])
      setAvatarByMemberId(new Map())
      setNotFound(true)
      setPageLoading(false)
      setLeaderboardLoading(false)
      return
    }

    const pool = poolData as Pool
    setPoolId(pool.id)
    setCanDelete(pool.creator_id === userId)

    const { data: membersData, error: membersError } = await supabase
      .from('pool_members')
      .select('id, user_id, display_name, joined_at')
      .eq('pool_id', pool.id)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('Failed to load members:', membersError.message)
    }

    const poolMembers = (membersData ?? []) as PoolMember[]

    const avatarByMemberId = new Map<string, string | null>()
    const { data: avatarRows, error: avatarError } = await supabase.rpc(
      'get_pool_member_avatars',
      { p_pool_id: pool.id },
    )

    if (avatarError) {
      console.error('Failed to load member avatars:', avatarError.message)
    } else {
      for (const row of avatarRows ?? []) {
        const memberId = String(row.member_id)
        avatarByMemberId.set(memberId, row.avatar ?? null)
      }
    }

    setAvatarByMemberId(avatarByMemberId)

    const isWinnerPool = pool.scoring_style === 'winner'

    const { predictionsByMember } = await fetchMemberPredictionCounts(
      supabase,
      poolMembers.map((member) => ({
        memberId: member.id,
        scoringStyle: pool.scoring_style,
      })),
    )

    const { count: totalMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })

    const { count: matchesPlayed } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('is_final', true)

    const matchesPlayedCount = matchesPlayed ?? 0

    const { data: stageMatchRows } = await supabase
      .from('matches')
      .select('round, kickoff_at, is_final')
      .order('kickoff_at', { ascending: true })

    const currentStage = deriveCurrentTournamentStage(
      (stageMatchRows ?? []) as Pick<
        MatchForPrediction,
        'round' | 'kickoff_at' | 'is_final'
      >[],
    )

    let nextMatchIn: string | null = null
    let nextMatchKickoffAt: string | null = null
    const { data: nextMatch } = await supabase
      .from('matches')
      .select('kickoff_at')
      .gt('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextMatch?.kickoff_at) {
      nextMatchKickoffAt = nextMatch.kickoff_at
      nextMatchIn = formatTimeUntil(nextMatch.kickoff_at)
    }

    const currentMember = poolMembers.find((m) => m.user_id === userId)
    setMemberId(currentMember?.id ?? null)
    const loadedUserPredictions: UserPoolPrediction[] = []
    let loadedWinnerGroups: WinnerGroupPrediction[] = []
    let loadedThirdPlaceTeams: string[] = []
    let memberHasPredictions = false

    if (currentMember) {
      if (pool.scoring_style === 'winner') {
        const [groupResult, thirdPlaceResult] = await Promise.all([
          supabase
            .from('group_predictions')
            .select('group_name, standings')
            .eq('pool_id', pool.id)
            .eq('member_id', currentMember.id),
          supabase
            .from('third_place_rankings')
            .select('rankings')
            .eq('pool_id', pool.id)
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        if (groupResult.error) {
          console.error(
            'Failed to load group predictions:',
            groupResult.error.message,
          )
        } else {
          loadedWinnerGroups = (groupResult.data ?? [])
            .map((row) => ({
              groupName: String(row.group_name).toUpperCase(),
              standings: parseStandingsJson(row.standings),
            }))
            .filter((group) => group.standings.length > 0)
            .sort((a, b) => a.groupName.localeCompare(b.groupName))
        }

        if (thirdPlaceResult.error) {
          console.error(
            'Failed to load third place rankings:',
            thirdPlaceResult.error.message,
          )
        } else {
          loadedThirdPlaceTeams = parseThirdPlaceRankingsJson(
            thirdPlaceResult.data?.rankings,
          )
        }

        memberHasPredictions =
          loadedWinnerGroups.length > 0 || loadedThirdPlaceTeams.length > 0
      } else {
        const { data: userPredRows, error: userPredError } = await supabase
          .from('predictions')
          .select(
            `
            match_id,
            pred_team1,
            pred_team2,
            matches (
              id,
              kickoff_at,
              round,
              group_name,
              team1_name,
              team2_name,
              team1_flag,
              team2_flag,
              result_team1,
              result_team2,
              is_final
            )
          `,
          )
          .eq('pool_id', pool.id)
          .eq('member_id', currentMember.id)

        if (userPredError) {
          console.error('Failed to load user predictions:', userPredError.message)
        } else {
          for (const row of (userPredRows ?? []) as PredictionWithMatch[]) {
            const matchRaw = row.matches
            const match = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw
            if (!match) continue

            loadedUserPredictions.push({
              matchId: match.id,
              kickoffAt: match.kickoff_at,
              round: match.round,
              groupName: match.group_name,
              team1Name: match.team1_name,
              team2Name: match.team2_name,
              team1Flag: match.team1_flag,
              team2Flag: match.team2_flag,
              predTeam1: row.pred_team1,
              predTeam2: row.pred_team2,
              resultTeam1: match.result_team1,
              resultTeam2: match.result_team2,
              isFinal: match.is_final,
            })
          }
        }

        memberHasPredictions = loadedUserPredictions.length > 0
      }
    }

    setPoolMeta({
      inviteCode: pool.invite_code,
      name: pool.name,
      scoringStyle: pool.scoring_style,
      stage: currentStage,
      memberCount: poolMembers.length,
      matchesPlayed: matchesPlayedCount,
      totalMatches: totalMatches ?? 0,
      nextMatchIn,
      nextMatchKickoffAt,
    })
    setUserPredictions(loadedUserPredictions)
    setWinnerGroups(loadedWinnerGroups)
    setThirdPlaceTeams(loadedThirdPlaceTeams)
    setHasPredictions(memberHasPredictions)
    setPageLoading(false)

    const { data: cacheData, error: cacheError } = await supabase
      .from('leaderboard_cache')
      .select('rank, prev_rank, member_id, total_points, correct_winners')
      .eq('pool_id', pool.id)
      .order('rank', { ascending: true })

    if (cacheError) {
      console.error('Failed to load leaderboard:', cacheError.message)
    }

    const leaderboardMembers = buildPoolLeaderboardMembers({
      poolMembers,
      creatorUserId: pool.creator_id,
      cacheRows: cacheData ?? null,
      matchesPlayedCount,
      currentUserId: userId,
      predictionsByMember,
      isWinnerPool,
      avatarsByMemberId: avatarByMemberId,
    })

    setMembers(leaderboardMembers)
    setLeaderboardLoading(false)
  }, [inviteCode, userId])

  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, userId, router, loadPoolData])

  if (authLoading || (!user && !notFound)) {
    return <PoolPageSkeleton />
  }

  if (pageLoading) {
    return <PoolPageSkeleton />
  }

  if (notFound || !poolMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Pool not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link may be invalid.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PoolHomeView
      pool={poolMeta}
      members={members}
      userPredictions={userPredictions}
      winnerGroups={winnerGroups}
      thirdPlaceTeams={thirdPlaceTeams}
      predictHref={`/pool/${inviteCode}/predict`}
      hasPredictions={hasPredictions}
      currentUserId={user!.id}
      leaderboardLoading={leaderboardLoading}
      canDelete={canDelete}
      poolId={poolId ?? undefined}
      memberId={memberId ?? undefined}
      avatarsByMemberId={avatarByMemberId}
    />
  )
}
