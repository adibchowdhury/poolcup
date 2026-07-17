'use client'

import type { FeaturedMatch } from '@/src/lib/featured-match'
import type { UpcomingMatch } from '../lib/fetch-upcoming-matches'
import type { MockFixtureWithSport } from '../lib/mock-sports-fixtures'
import { LiveScoreboardCard } from './mobile-live-scoreboard'
import {
  ScoreboardCardShell,
  ScoreboardCompetitionLabel,
  ScoreboardHeaderRow,
  ScoreboardKickoffTopRight,
  ScoreboardLiveTopRight,
  ScoreboardMatchupGrid,
  ScoreboardMonogramTeam,
  ScoreboardRoundPill,
  ScoreboardScoreCenter,
  ScoreboardVsCenter,
} from './mobile-scoreboard-card-shared'

function upcomingToFeatured(match: UpcomingMatch): FeaturedMatch {
  return {
    id: match.id,
    team1_name: match.team1_name,
    team2_name: match.team2_name,
    team1_flag: match.team1_flag,
    team2_flag: match.team2_flag,
    result_team1: null,
    result_team2: null,
    status_short: 'NS',
    elapsed_minute: null,
    kickoff_at: match.kickoff_at,
    group_name: match.group_name,
    round: match.round,
    is_final: false,
  }
}

export function RealUpcomingScoreboardCard({
  match,
  onOpenMatch,
}: {
  match: UpcomingMatch
  onOpenMatch: (matchId: string) => void
}) {
  return (
    <LiveScoreboardCard
      match={upcomingToFeatured(match)}
      mode="upcoming"
      onOpenMatch={onOpenMatch}
    />
  )
}

export function MockUpcomingScoreboardCard({
  fixture,
}: {
  fixture: MockFixtureWithSport
}) {
  const isLive = fixture.status === 'live'
  const groupPillLabel = `${fixture.sportLabel} · ${fixture.round_label}`
  const score1 = fixture.score1 ?? 0
  const score2 = fixture.score2 ?? 0

  const topRight = isLive ? (
    <ScoreboardLiveTopRight clockLabel={fixture.live_label ?? 'Live'} />
  ) : (
    <ScoreboardKickoffTopRight kickoffAt={fixture.kickoff_at} />
  )

  const center = isLive ? (
    <ScoreboardScoreCenter score1={score1} score2={score2} />
  ) : (
    <ScoreboardVsCenter />
  )

  return (
    <ScoreboardCardShell>
      <ScoreboardCompetitionLabel label={fixture.sportLabel} />

      <div className="flex min-h-0 flex-1 flex-col gap-0.5">
        <ScoreboardHeaderRow
          leftPill={<ScoreboardRoundPill label={groupPillLabel} />}
          topRight={topRight}
        />

        <ScoreboardMatchupGrid
          centerIsScore={isLive}
          team1={
            <ScoreboardMonogramTeam
              code={fixture.team1_code}
              name={fixture.team1_name}
            />
          }
          center={center}
          team2={
            <ScoreboardMonogramTeam
              code={fixture.team2_code}
              name={fixture.team2_name}
            />
          }
        />
      </div>
    </ScoreboardCardShell>
  )
}
