'use client'

import { useEffect, useState } from 'react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { useClientNow } from '@/hooks/use-client-now'
import { formatFeaturedMatchRoundLabel } from '@/src/lib/featured-match'
import type { ClassicMatchRow } from '@/src/lib/merge-classic-match-predictions'
import {
  normalizeMatchScoringStyle,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'
import { supabase } from '../lib/supabase-mobile'
import { MobileMatchPicksExpander } from './mobile-match-picks-expander'

const MATCH_COLUMNS =
  'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round, result_team1, result_team2, is_final, advancing_team'

type MobilePoolPastMatchesPicksProps = {
  poolId: string
  scoringStyle: string
  currentUserId: string
}

function MatchSummaryCard({
  match,
  poolId,
  scoringStyle,
  currentUserId,
}: {
  match: ClassicMatchRow
  poolId: string
  scoringStyle: MatchScoringStyle
  currentUserId: string
}) {
  const roundLabel = formatFeaturedMatchRoundLabel(
    match.round,
    match.group_name,
  )
  const isFinal = match.is_final
  const showScore =
    isFinal &&
    match.result_team1 != null &&
    match.result_team2 != null

  return (
    <li className="rounded-xl border border-border bg-card/90 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {roundLabel}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <TeamFlagImage
          countryName={match.team1_name}
          dbFlag={match.team1_flag}
          imgClassName="h-6 w-auto"
          emojiClassName="text-lg"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {match.team1_name}
        </span>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
          {showScore
            ? `${match.result_team1}–${match.result_team2}`
            : 'vs'}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-foreground">
          {match.team2_name}
        </span>
        <TeamFlagImage
          countryName={match.team2_name}
          dbFlag={match.team2_flag}
          imgClassName="h-6 w-auto"
          emojiClassName="text-lg"
        />
      </div>

      <MobileMatchPicksExpander
        poolId={poolId}
        matchId={match.id}
        scoringStyle={scoringStyle}
        kickoffAt={match.kickoff_at}
        isFinal={isFinal}
        resultTeam1={match.result_team1}
        resultTeam2={match.result_team2}
        round={match.round}
        advancingTeam={match.advancing_team}
        currentUserId={currentUserId}
        team1Name={match.team1_name}
        team2Name={match.team2_name}
        team1Flag={match.team1_flag}
        team2Flag={match.team2_flag}
      />
    </li>
  )
}

export function MobilePoolPastMatchesPicks({
  poolId,
  scoringStyle,
  currentUserId,
}: MobilePoolPastMatchesPicksProps) {
  const { mounted, nowMs } = useClientNow(30_000)
  const [matches, setMatches] = useState<ClassicMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedScoring = normalizeMatchScoringStyle(scoringStyle)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('is_final', true)
        .order('kickoff_at', { ascending: false })
        .limit(15)

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setMatches([])
      } else {
        setMatches((data ?? []) as ClassicMatchRow[])
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const kickedOffMatches = mounted
    ? matches.filter((match) => new Date(match.kickoff_at).getTime() <= nowMs)
    : []

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading recent matches…</p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (kickedOffMatches.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-xl tracking-wide text-foreground">
          Recent matches
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          After kickoff, see how everyone in this pool predicted each result.
        </p>
      </div>
      <ul className="space-y-3">
        {kickedOffMatches.map((match) => (
          <MatchSummaryCard
            key={match.id}
            match={match}
            poolId={poolId}
            scoringStyle={normalizedScoring}
            currentUserId={currentUserId}
          />
        ))}
      </ul>
    </section>
  )
}
