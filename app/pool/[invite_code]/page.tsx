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
import type { UserPoolPrediction } from '@/components/pool/pool-predictions-tab'

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

type LeaderboardEntry = {
  rank: number
  prev_rank: number | null
  member_id: string
  user_id: string
  display_name: string
  points: number
  correct_predictions: number
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

const ROUND_STAGE_LABELS: Record<string, string> = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter Finals',
  sf: 'Semi Finals',
  final: 'Final',
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

function getMovement(
  rank: number,
  prevRank: number | null,
): 'up' | 'down' | 'none' {
  if (prevRank == null || prevRank <= 0) return 'none'
  const delta = prevRank - rank
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'none'
}

function sortPoolMembersForPreMatch(
  members: PoolMember[],
  creatorUserId: string,
): PoolMember[] {
  const creator = members.find((m) => m.user_id === creatorUserId)
  const rest = members
    .filter((m) => m.user_id !== creatorUserId)
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    )

  return creator ? [creator, ...rest] : rest
}

function deriveStageLabel(roundCounts: Record<string, number>): string {
  const entries = Object.entries(roundCounts).filter(([, n]) => n > 0)
  if (entries.length === 0) return 'Group Stage'
  const sorted = entries.sort((a, b) => b[1] - a[1])
  const topRound = sorted[0][0]
  return ROUND_STAGE_LABELS[topRound] ?? 'Group Stage'
}

export default function PoolPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()

  const [poolMeta, setPoolMeta] = useState<PoolHomeMeta | null>(null)
  const [members, setMembers] = useState<LeaderboardMember[]>([])
  const [userPredictions, setUserPredictions] = useState<UserPoolPrediction[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [poolId, setPoolId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [canDelete, setCanDelete] = useState(false)

  const loadPoolData = useCallback(async () => {
    if (!user) return

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
      setNotFound(true)
      setPageLoading(false)
      setLeaderboardLoading(false)
      return
    }

    const pool = poolData as Pool
    setPoolId(pool.id)
    setCanDelete(pool.creator_id === user.id)

    const { data: membersData, error: membersError } = await supabase
      .from('pool_members')
      .select('id, user_id, display_name, joined_at')
      .eq('pool_id', pool.id)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('Failed to load members:', membersError.message)
    }

    const poolMembers = (membersData ?? []) as PoolMember[]
    const memberById = new Map(poolMembers.map((m) => [m.id, m]))
    const memberIds = poolMembers.map((m) => m.id)

    const predictionsByMember = new Map<string, number>()
    if (memberIds.length > 0) {
      const { data: predictions } = await supabase
        .from('predictions')
        .select('member_id, match_id')
        .eq('pool_id', pool.id)
        .in('member_id', memberIds)

      const distinct = new Map<string, Set<string>>()
      for (const row of predictions ?? []) {
        if (!distinct.has(row.member_id)) {
          distinct.set(row.member_id, new Set())
        }
        distinct.get(row.member_id)!.add(row.match_id)
      }
      for (const [memberId, matchIds] of distinct) {
        predictionsByMember.set(memberId, matchIds.size)
      }
    }

    const buildFallbackEntries = (): LeaderboardEntry[] =>
      poolMembers.map((member, index) => ({
        rank: index + 1,
        prev_rank: null,
        member_id: member.id,
        user_id: member.user_id,
        display_name: member.display_name,
        points: 0,
        correct_predictions: 0,
      }))

    const { count: totalMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })

    const { count: matchesPlayed } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('is_final', true)

    const matchesPlayedCount = matchesPlayed ?? 0

    const { data: roundRows } = await supabase.from('matches').select('round')

    const roundCounts: Record<string, number> = {}
    for (const row of roundRows ?? []) {
      const round = row.round as string
      roundCounts[round] = (roundCounts[round] ?? 0) + 1
    }

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

    const currentMember = poolMembers.find((m) => m.user_id === user.id)
    setMemberId(currentMember?.id ?? null)
    const loadedUserPredictions: UserPoolPrediction[] = []

    if (currentMember) {
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
    }

    setPoolMeta({
      inviteCode: pool.invite_code,
      name: pool.name,
      scoringStyle: pool.scoring_style,
      stage: deriveStageLabel(roundCounts),
      memberCount: poolMembers.length,
      matchesPlayed: matchesPlayedCount,
      totalMatches: totalMatches ?? 0,
      nextMatchIn,
      nextMatchKickoffAt,
    })
    setUserPredictions(loadedUserPredictions)
    setPageLoading(false)

    const { data: cacheData, error: cacheError } = await supabase
      .from('leaderboard_cache')
      .select('rank, prev_rank, member_id, total_points, correct_winners')
      .eq('pool_id', pool.id)
      .order('rank', { ascending: true })

    let entries: LeaderboardEntry[]

    if (matchesPlayedCount === 0) {
      const orderedMembers = sortPoolMembersForPreMatch(
        poolMembers,
        pool.creator_id,
      )
      entries = orderedMembers.map((member, index) => ({
        rank: index + 1,
        prev_rank: null,
        member_id: member.id,
        user_id: member.user_id,
        display_name: member.display_name,
        points: 0,
        correct_predictions: 0,
      }))
    } else {
      entries = buildFallbackEntries()

      if (cacheError) {
        console.error('Failed to load leaderboard:', cacheError.message)
      } else if (cacheData && cacheData.length > 0) {
        entries = cacheData.map((row) => {
          const member = memberById.get(row.member_id)
          return {
            rank: row.rank,
            prev_rank: row.prev_rank > 0 ? row.prev_rank : null,
            member_id: row.member_id,
            user_id: member?.user_id ?? '',
            display_name: member?.display_name ?? 'Unknown',
            points: row.total_points ?? 0,
            correct_predictions: row.correct_winners ?? 0,
          }
        })
      }
    }

    const leaderboardMembers: LeaderboardMember[] = entries.map((entry) => ({
      id: entry.member_id,
      name: entry.display_name,
      isYou: user.id === entry.user_id,
      avatar: entry.display_name.charAt(0).toUpperCase(),
      points: entry.points,
      correctPredictions: entry.correct_predictions,
      totalPredictions: predictionsByMember.get(entry.member_id) ?? 0,
      movement: getMovement(entry.rank, entry.prev_rank),
      streak: 0,
    }))

    setMembers(leaderboardMembers)
    setLeaderboardLoading(false)
  }, [inviteCode, user])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, user, router, loadPoolData])

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

  const yourPredictions = userPredictions.length

  return (
    <PoolHomeView
      pool={poolMeta}
      members={members}
      userPredictions={userPredictions}
      predictHref={`/pool/${inviteCode}/predict`}
      yourPredictions={yourPredictions}
      leaderboardLoading={leaderboardLoading}
      canDelete={canDelete}
      poolId={poolId ?? undefined}
      memberId={memberId ?? undefined}
    />
  )
}
