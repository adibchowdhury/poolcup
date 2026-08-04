'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  GlobalMatchDetailView,
  type GlobalMatchDisplay,
} from '@/components/match/global-match-detail-view'
import { useAuth } from '@/src/lib/auth-context'
import type { ClassicMatchRow } from '@/src/lib/merge-classic-match-predictions'
import { deriveGlobalMatchPhase } from '@/src/lib/global-match-phase'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  parseMatchPredictionDistribution,
  type MatchPredictionDistribution,
} from '@/src/lib/match-prediction-distribution'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import {
  fetchMyMatchPredictions,
  type MyMatchPredictions,
} from '@/src/lib/my-match-predictions'

const MATCH_COLUMNS =
  'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute'

const LIVE_REFETCH_MS = 30_000

function GlobalMatchPageSkeleton() {
  return (
    <div
      className={cn('min-h-screen bg-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}
      aria-busy="true"
      aria-label="Loading match"
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ShimmerBlock className="mb-4 h-14 w-full rounded-xl" />
        <ShimmerBlock className="mb-4 h-48 w-full rounded-2xl" />
        <ShimmerBlock className="mb-4 h-40 w-full rounded-2xl" />
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function toGlobalMatchDisplay(match: ClassicMatchRow): GlobalMatchDisplay {
  return {
    team1Name: match.team1_name,
    team2Name: match.team2_name,
    team1Flag: match.team1_flag,
    team2Flag: match.team2_flag,
    team1Logo: match.team1_logo ?? null,
    team2Logo: match.team2_logo ?? null,
    kickoffAt: match.kickoff_at,
    round: match.round,
    groupName: match.group_name,
    resultTeam1: match.result_team1,
    resultTeam2: match.result_team2,
    advancingTeam: match.advancing_team,
    statusShort: match.status_short,
    elapsedMinute: match.elapsed_minute,
  }
}

export function GlobalMatchDetailPage({ matchId }: { matchId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [match, setMatch] = useState<ClassicMatchRow | null>(null)
  const [distribution, setDistribution] =
    useState<MatchPredictionDistribution | null>(null)
  const [myPredictions, setMyPredictions] = useState<MyMatchPredictions | null>(
    null,
  )
  const [myPredictionsLoading, setMyPredictionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadMatch = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('id', matchId)
      .maybeSingle()

    if (error) {
      console.error('Failed to load match:', error.message)
    }

    if (!data) {
      setNotFound(true)
      setMatch(null)
      setDistribution(null)
      setMyPredictions(null)
      setLoading(false)
      return
    }

    const matchRow = data as ClassicMatchRow
    setNotFound(false)
    setMatch(matchRow)

    if (isMatchLocked(matchRow.locked_at)) {
      const { data: distData, error: distError } = await supabase.rpc(
        'get_match_prediction_distribution',
        {
          p_match_id: matchId,
          p_pool_id: null,
        },
      )

      if (distError) {
        console.error('Failed to load global distribution:', distError.message)
        setDistribution(null)
      } else {
        setDistribution(parseMatchPredictionDistribution(distData))
      }
    } else {
      setDistribution(null)
    }

    setLoading(false)
  }, [matchId])

  const loadMyPredictions = useCallback(async () => {
    if (!user) {
      setMyPredictions(null)
      setMyPredictionsLoading(false)
      return
    }

    setMyPredictionsLoading(true)

    const predictions = await fetchMyMatchPredictions(supabase, matchId)
    setMyPredictions(predictions)
    setMyPredictionsLoading(false)
  }, [matchId, user])

  useEffect(() => {
    void loadMatch(true)
  }, [loadMatch])

  useEffect(() => {
    if (authLoading) return
    void loadMyPredictions()
  }, [authLoading, loadMyPredictions])

  const phase = useMemo(
    () => (match ? deriveGlobalMatchPhase(match) : null),
    [match],
  )

  useEffect(() => {
    if (!match || phase !== 'live') return

    const interval = window.setInterval(() => {
      void loadMatch(false)
    }, LIVE_REFETCH_MS)

    return () => window.clearInterval(interval)
  }, [match, phase, loadMatch])

  if (loading) {
    return <GlobalMatchPageSkeleton />
  }

  if (notFound || !match || !phase) {
    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-background px-4',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Match not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This match may not exist or may have been removed.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <GlobalMatchDetailView
      matchId={matchId}
      match={toGlobalMatchDisplay(match)}
      phase={phase}
      distribution={distribution}
      myPredictions={myPredictions}
      myPredictionsLoading={myPredictionsLoading}
      authLoading={authLoading}
      isLoggedIn={Boolean(user)}
    />
  )
}
