'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'
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
  onTeamTap: (teamName: string) => void
  onClear: () => void
}

export function GroupStandingCard({
  groupLetter,
  teams,
  standings,
  onTeamTap,
  onClear,
}: GroupStandingCardProps) {
  const complete = standings.length === teams.length && teams.length > 0

  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-border/90 bg-card/90 p-2 shadow-sm backdrop-blur-sm',
        complete && 'border-primary/20',
      )}
    >
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1">
        <h3 className="min-w-0 truncate font-display text-xs tracking-wide text-foreground uppercase">
          Group {groupLetter}
        </h3>
        <button
          type="button"
          onClick={onClear}
          disabled={standings.length === 0}
          className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams loaded yet.</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-1">
          {teams.map((team) => {
            const rank = getTeamRank(standings, team)
            return (
              <li key={team} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onTeamTap(team)}
                  className={cn(
                    'flex w-full min-w-0 max-w-full items-center gap-1 rounded-md border px-1.5 py-1.5 text-left transition-all duration-200',
                    rankStyles(rank),
                  )}
                >
                  <TeamFlagImage countryName={team} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-foreground">
                    {team}
                  </span>
                  {rank !== null && (
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold',
                        rank <= 2 && 'bg-primary/20 text-primary',
                        rank === 3 && 'bg-secondary/20 text-secondary',
                        rank === 4 && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {rank}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
