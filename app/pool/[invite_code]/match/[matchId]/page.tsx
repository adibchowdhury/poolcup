'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import { PoolPageSkeleton } from '@/components/pool/pool-page-skeleton'
import {
  MatchDetailView,
  deriveMatchPhase,
  type MatchPredictionDistribution,
} from '@/components/pool/match-detail-view'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import {
  mergeMatchesWithPredictions,
  type ClassicMatchRow,
  type ClassicPredictionRow,
} from '@/src/lib/merge-classic-match-predictions'
import { isMatchLocked } from '@/src/lib/match-lock'
import { fetchMatchPoolPicks, type MatchPoolPick } from '@/src/lib/match-pool-picks'
import {
  normalizeMatchScoringStyle,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'
import {
  fetchUserPoolSummaries,
  writeLastViewedPoolInviteCode,
  type UserPoolRef,
} from '@/src/lib/resolve-match-pool'

type Pool = {
  id: string
  name: string
  invite_code: string
  scoring_style: string
}

const MATCH_COLUMNS =
  'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute'

const LIVE_REFETCH_MS = 30_000

function parseDistribution(data: unknown): MatchPredictionDistribution | null {
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const outcomesRaw = row.outcomes
  const topScoresRaw = row.top_scores

  if (!outcomesRaw || typeof outcomesRaw !== 'object') return null

  const outcomes = outcomesRaw as Record<string, unknown>

  return {
    total: typeof row.total === 'number' ? row.total : 0,
    outcomes: {
      team1_win: typeof outcomes.team1_win === 'number' ? outcomes.team1_win : 0,
      draw: typeof outcomes.draw === 'number' ? outcomes.draw : 0,
      team2_win: typeof outcomes.team2_win === 'number' ? outcomes.team2_win : 0,
    },
    top_scores: Array.isArray(topScoresRaw)
      ? topScoresRaw
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const score = item as Record<string, unknown>
            if (
              typeof score.team1 !== 'number' ||
              typeof score.team2 !== 'number' ||
              typeof score.count !== 'number'
            ) {
              return null
            }
            return {
              team1: score.team1,
              team2: score.team2,
              count: score.count,
            }
          })
          .filter((item): item is { team1: number; team2: number; count: number } =>
            item != null,
          )
      : [],
  }
}

export default function PoolMatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const matchId = params.matchId as string
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [winnerPool, setWinnerPool] = useState(false)
  const [poolName, setPoolName] = useState('')
  const [poolId, setPoolId] = useState<string | null>(null)
  const [scoringStyle, setScoringStyle] = useState<MatchScoringStyle>('classic')
  const [prediction, setPrediction] = useState<UserPoolPrediction | null>(null)
  const [statusShort, setStatusShort] = useState<string | null>(null)
  const [elapsedMinute, setElapsedMinute] = useState<number | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null)
  const [poolDistribution, setPoolDistribution] =
    useState<MatchPredictionDistribution | null>(null)
  const [globalDistribution, setGlobalDistribution] =
    useState<MatchPredictionDistribution | null>(null)
  const [poolPicks, setPoolPicks] = useState<MatchPoolPick[] | null>(null)
  const [poolPicksLoading, setPoolPicksLoading] = useState(false)
  const [poolPicksError, setPoolPicksError] = useState<string | null>(null)
  const [avatarsByMemberId, setAvatarsByMemberId] = useState(
    () => new Map<string, string | null>(),
  )
  const [userPools, setUserPools] = useState<UserPoolRef[]>([])

  const loadLockedExtras = useCallback(
    async (
      resolvedPoolId: string,
      resolvedScoringStyle: MatchScoringStyle,
      match: ClassicMatchRow,
    ) => {
      if (!isMatchLocked(match.locked_at)) {
        setPoolDistribution(null)
        setGlobalDistribution(null)
        setPoolPicks(null)
        setPoolPicksLoading(false)
        setPoolPicksError(null)
        setAvatarsByMemberId(new Map())
        return
      }

      setPoolPicksLoading(true)
      setPoolPicksError(null)

      const avatarByMemberId = new Map<string, string | null>()
      const [
        poolDistResult,
        globalDistResult,
        picksResult,
        avatarResult,
      ] = await Promise.all([
        supabase.rpc('get_match_prediction_distribution', {
          p_match_id: matchId,
          p_pool_id: resolvedPoolId,
        }),
        supabase.rpc('get_match_prediction_distribution', {
          p_match_id: matchId,
          p_pool_id: null,
        }),
        fetchMatchPoolPicks(supabase, resolvedPoolId, matchId, {
          isFinal: match.is_final,
          resultTeam1: match.result_team1,
          resultTeam2: match.result_team2,
          scoringStyle: resolvedScoringStyle,
        }),
        supabase.rpc('get_pool_member_avatars', {
          p_pool_id: resolvedPoolId,
        }),
      ])

      if (poolDistResult.error) {
        console.error(
          'Failed to load pool distribution:',
          poolDistResult.error.message,
        )
        setPoolDistribution(null)
      } else {
        setPoolDistribution(parseDistribution(poolDistResult.data))
      }

      if (globalDistResult.error) {
        console.error(
          'Failed to load global distribution:',
          globalDistResult.error.message,
        )
        setGlobalDistribution(null)
      } else {
        setGlobalDistribution(parseDistribution(globalDistResult.data))
      }

      if (picksResult.error) {
        setPoolPicksError(picksResult.error)
        setPoolPicks([])
      } else {
        setPoolPicks(picksResult.picks)
      }

      if (avatarResult.error) {
        console.error('Failed to load member avatars:', avatarResult.error.message)
      } else {
        for (const row of avatarResult.data ?? []) {
          avatarByMemberId.set(String(row.member_id), row.avatar ?? null)
        }
      }

      setAvatarsByMemberId(avatarByMemberId)
      setPoolPicksLoading(false)
    },
    [matchId],
  )

  const loadMatchDetail = useCallback(async () => {
    if (!userId) return

    setPageLoading(true)
    setNotFound(false)

    const [{ data: pool, error: poolError }, poolSummaries] = await Promise.all([
      supabase
        .from('pools')
        .select('id, name, invite_code, scoring_style')
        .eq('invite_code', inviteCode)
        .maybeSingle(),
      fetchUserPoolSummaries(supabase, userId),
    ])

    setUserPools(poolSummaries)

    if (poolError) {
      console.error('Failed to load pool:', poolError.message)
    }

    if (!pool) {
      setNotFound(true)
      setPageLoading(false)
      return
    }

    const poolRow = pool as Pool

    if (poolRow.scoring_style === 'winner') {
      setWinnerPool(true)
      setPoolName(poolRow.name)
      setPageLoading(false)
      return
    }

    const resolvedScoringStyle = normalizeMatchScoringStyle(poolRow.scoring_style)
    setWinnerPool(false)
    setPoolName(poolRow.name)
    setPoolId(poolRow.id)
    setScoringStyle(resolvedScoringStyle)

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('id', matchId)
      .maybeSingle()

    if (matchError) {
      console.error('Failed to load match:', matchError.message)
    }

    if (!matchData) {
      setNotFound(true)
      setPageLoading(false)
      return
    }

    const match = matchData as ClassicMatchRow
    setStatusShort(match.status_short)
    setElapsedMinute(match.elapsed_minute)

    const { data: membership, error: membershipError } = await supabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolRow.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      console.error('Failed to load membership:', membershipError.message)
    }

    const memberId = membership?.id ?? null
    let predictionRows: ClassicPredictionRow[] = []
    let awarded: number | null = null

    if (memberId) {
      const { data: predictionData, error: predictionError } = await supabase
        .from('predictions')
        .select('match_id, pred_team1, pred_team2, advance_pick, points_awarded')
        .eq('pool_id', poolRow.id)
        .eq('member_id', memberId)
        .eq('match_id', matchId)
        .maybeSingle()

      if (predictionError) {
        console.error('Failed to load prediction:', predictionError.message)
      }

      if (predictionData) {
        predictionRows = [
          {
            match_id: predictionData.match_id,
            pred_team1: predictionData.pred_team1,
            pred_team2: predictionData.pred_team2,
            advance_pick: predictionData.advance_pick,
          },
        ]
        awarded =
          typeof predictionData.points_awarded === 'number'
            ? predictionData.points_awarded
            : null
      }
    }

    const [mergedPrediction] = mergeMatchesWithPredictions(
      [match],
      predictionRows,
    )
    setPrediction(mergedPrediction ?? null)
    setPointsAwarded(awarded)

    await loadLockedExtras(poolRow.id, resolvedScoringStyle, match)

    setPageLoading(false)
  }, [inviteCode, matchId, userId, loadLockedExtras])

  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      router.replace('/login')
      return
    }

    void loadMatchDetail()
  }, [authLoading, userId, router, loadMatchDetail])

  useEffect(() => {
    writeLastViewedPoolInviteCode(inviteCode)
  }, [inviteCode])

  useEffect(() => {
    if (!prediction || !poolId) return
    const phase = deriveMatchPhase(prediction)
    if (phase !== 'live') return

    const interval = window.setInterval(() => {
      void loadMatchDetail()
    }, LIVE_REFETCH_MS)

    return () => window.clearInterval(interval)
  }, [prediction, poolId, loadMatchDetail])

  if (authLoading || pageLoading) {
    return <PoolPageSkeleton />
  }

  if (winnerPool) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">
            Not available for this pool type
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Match detail is only available for score-prediction pools.
          </p>
          <Link
            href={`/pool/${inviteCode}`}
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to pool
          </Link>
        </div>
      </div>
    )
  }

  if (notFound || !prediction || !poolId || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Match not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This match may not exist, or the pool link may be invalid.
          </p>
          <Link
            href={`/pool/${inviteCode}`}
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to pool
          </Link>
        </div>
      </div>
    )
  }

  return (
    <MatchDetailView
      inviteCode={inviteCode}
      poolName={poolName}
      poolId={poolId}
      matchId={matchId}
      scoringStyle={scoringStyle}
      currentUserId={userId}
      prediction={prediction}
      pointsAwarded={pointsAwarded}
      phase={deriveMatchPhase(prediction)}
      statusShort={statusShort}
      elapsedMinute={elapsedMinute}
      poolDistribution={poolDistribution}
      globalDistribution={globalDistribution}
      poolPicks={poolPicks}
      poolPicksLoading={poolPicksLoading}
      poolPicksError={poolPicksError}
      avatarsByMemberId={avatarsByMemberId}
      userPools={userPools}
    />
  )
}
