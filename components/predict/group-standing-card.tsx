'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'
import { groupStageRankLabel } from '@/src/lib/world-cup-2026-bracket'
import { getTeamRank } from '@/src/lib/world-cup-groups'

function TeamFlagImage({ countryName }: { countryName: string }) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const showFlagImage = hasFlagImage(countryName)

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (!showFlagImage || imageFailed) {
    return (
      <span className="shrink-0 text-base leading-none" aria-hidden>
        {resolveTeamFlagDisplay(countryName, null)}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt=""
      className="h-4 w-auto max-w-[1.25rem] shrink-0 object-contain"
      onError={() => setImageFailed(true)}
    />
  )
}

function rankStyles(rank: number | null): string {
  if (rank === 1 || rank === 2) {
    return 'border-primary/50 bg-primary/10'
  }
  if (rank === 3) {
    return 'border-secondary/50 bg-secondary/10'
  }
  if (rank === 4) {
    return 'border-border/60 bg-muted/30 opacity-60'
  }
  return 'border-border/80 bg-card/80 hover:border-primary/35 hover:bg-card'
}

interface GroupStandingCardProps {
  groupLetter: string
  teams: string[]
  standings: string[]
  readOnly?: boolean
  onTeamTap: (teamName: string) => void
}

export function GroupStandingCard({
  groupLetter,
  teams,
  standings,
  readOnly = false,
  onTeamTap,
}: GroupStandingCardProps) {
  const complete = standings.length === teams.length && teams.length > 0

  return (
    <article
      aria-label={
        readOnly
          ? `Group ${groupLetter}, locked — matches started`
          : `Group ${groupLetter}`
      }
      className={cn(
        'relative min-w-0 overflow-hidden rounded-lg border bg-card/90 p-2 shadow-sm backdrop-blur-sm',
        complete && !readOnly && 'border-primary/20',
        readOnly
          ? 'border-muted-foreground/45 bg-muted/25'
          : 'border-border/90',
      )}
    >
      <div className="relative z-[1] mb-1.5 min-w-0">
        <h3 className="font-display text-xs tracking-wide text-foreground uppercase">
          Group {groupLetter}
        </h3>
        {readOnly && (
          <p className="mt-0.5 text-[10px] normal-case tracking-normal text-muted-foreground">
            Locked — matches started
          </p>
        )}
      </div>

      {teams.length === 0 ? (
        <p className="relative z-[1] text-sm text-muted-foreground">
          No teams loaded yet.
        </p>
      ) : (
        <ul className="relative z-[1] flex min-w-0 flex-col gap-1">
          {teams.map((team) => {
            const rank = getTeamRank(standings, team)
            return (
              <li key={team} className="min-w-0">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onTeamTap(team)}
                  className={cn(
                    'flex w-full min-w-0 max-w-full items-center gap-1 rounded-md border px-1.5 py-1.5 text-left transition-all duration-200',
                    rankStyles(rank),
                    readOnly && 'cursor-default',
                  )}
                >
                  <TeamFlagImage countryName={team} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-foreground">
                    {team}
                  </span>
                  {rank !== null && (
                    <span
                      className={cn(
                        'shrink-0 font-mono font-bold',
                        rank === 4
                          ? 'rounded bg-muted/50 px-1 py-0.5 text-[8px] uppercase tracking-wide text-muted-foreground'
                          : 'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                        rank <= 2 && 'bg-primary/20 text-primary',
                        rank === 3 && 'bg-secondary/20 text-secondary',
                      )}
                    >
                      {groupStageRankLabel(rank)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {readOnly && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] rounded-lg bg-muted/20 ring-1 ring-inset ring-muted-foreground/25"
          aria-hidden
        />
      )}
    </article>
  )
}
