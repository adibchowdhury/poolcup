'use client'

import { notFound } from 'next/navigation'
import { CompactMatchRow } from '@/components/predict/compact-match-row'
import { MlsPlayoffStageSections } from '@/components/predict/mls-playoff-stage-sections'
import { SeasonPlayoffTabs } from '@/components/predict/season-playoff-tabs'
import { useMemo, useState } from 'react'
import type { SeasonPlayoffPhaseId } from '@/components/predict/season-playoff-tabs'
import {
  hasMlsPlayoffRounds,
  isMlsPlayoffRound,
  isSeasonFlatRound,
  type MlsPlayoffRoundId,
} from '@/src/lib/mls-playoff-rounds'
import { resolveTeamFlag } from '@/src/lib/team-flags'

/**
 * Local fixture preview only — never writes to the database.
 * Available at /dev/mls-playoffs-preview in `next dev`.
 */
const PREVIEW_MATCHES: Array<{
  id: string
  round: MlsPlayoffRoundId | 'league'
  kickoff_at: string
  team1: string
  team2: string
}> = [
  {
    id: 'reg-1',
    round: 'league',
    kickoff_at: '2026-10-12T00:00:00.000Z',
    team1: 'LAFC',
    team2: 'Austin FC',
  },
  {
    id: 'wc-1',
    round: 'po_wildcard',
    kickoff_at: '2026-10-22T01:00:00.000Z',
    team1: 'Sounders',
    team2: 'Portland',
  },
  {
    id: 'r1-1',
    round: 'po_r1',
    kickoff_at: '2026-10-26T00:30:00.000Z',
    team1: 'Inter Miami',
    team2: 'Atlanta United',
  },
  {
    id: 'r1-2',
    round: 'po_r1',
    kickoff_at: '2026-10-27T01:00:00.000Z',
    team1: 'Columbus',
    team2: 'NYCFC',
  },
  {
    id: 'csf-1',
    round: 'po_conf_sf',
    kickoff_at: '2026-11-02T01:00:00.000Z',
    team1: 'Inter Miami',
    team2: 'Columbus',
  },
  {
    id: 'cf-1',
    round: 'po_conf_final',
    kickoff_at: '2026-11-08T01:00:00.000Z',
    team1: 'Inter Miami',
    team2: 'Cincinnati',
  },
  {
    id: 'cup-1',
    round: 'po_final',
    kickoff_at: '2026-11-15T20:00:00.000Z',
    team1: 'Inter Miami',
    team2: 'LAFC',
  },
]

function team(name: string) {
  return {
    name,
    flag: resolveTeamFlag(name),
    dbFlag: null,
    logoUrl: null,
  }
}

export default function MlsPlayoffsPreviewPage() {
  const [phase, setPhase] = useState<SeasonPlayoffPhaseId>('playoffs')

  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
  const mixed = hasMlsPlayoffRounds(PREVIEW_MATCHES)

  const visible = useMemo(() => {
    if (phase === 'playoffs') {
      return PREVIEW_MATCHES.filter((match) => isMlsPlayoffRound(match.round))
    }
    return PREVIEW_MATCHES.filter((match) => isSeasonFlatRound(match.round))
  }, [phase])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Dev preview · no production data
          </p>
          <h1 className="font-display text-3xl tracking-wide text-foreground uppercase">
            MLS Playoffs layout
          </h1>
          <p className="text-sm text-muted-foreground">
            Mixed mode {mixed ? 'on' : 'off'} · in-memory fixtures only.
          </p>
          <SeasonPlayoffTabs activeId={phase} onChange={setPhase} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        {phase === 'playoffs' ? (
          <MlsPlayoffStageSections
            items={visible}
            getKickoffMs={(match) => new Date(match.kickoff_at).getTime()}
            getKey={(match) => match.id}
            renderMatch={(match) => (
              <div className="overflow-hidden rounded-xl border border-border/90 bg-card/40">
                <CompactMatchRow
                  homeTeam={team(match.team1)}
                  awayTeam={team(match.team2)}
                  homeScore=""
                  awayScore=""
                  kickoffAt={match.kickoff_at}
                  onHomeScoreChange={() => undefined}
                  onAwayScoreChange={() => undefined}
                />
              </div>
            )}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((match) => (
              <div
                key={match.id}
                className="overflow-hidden rounded-xl border border-border/90 bg-card/40"
              >
                <CompactMatchRow
                  homeTeam={team(match.team1)}
                  awayTeam={team(match.team2)}
                  homeScore=""
                  awayScore=""
                  kickoffAt={match.kickoff_at}
                  onHomeScoreChange={() => undefined}
                  onAwayScoreChange={() => undefined}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
