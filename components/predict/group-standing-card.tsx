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
      <span className="text-xl leading-none" aria-hidden>
        {resolveTeamFlagDisplay(countryName, null)}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt=""
      className="h-6 w-auto shrink-0"
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
        'rounded-xl border border-border/90 bg-card/90 p-4 shadow-sm backdrop-blur-sm',
        complete && 'border-primary/20',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-wide text-foreground uppercase">
          Group {groupLetter}
        </h3>
        <button
          type="button"
          onClick={onClear}
          disabled={standings.length === 0}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams loaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => {
            const rank = getTeamRank(standings, team)
            return (
              <li key={team}>
                <button
                  type="button"
                  onClick={() => onTeamTap(team)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all duration-200',
                    rankStyles(rank),
                  )}
                >
                  <TeamFlagImage countryName={team} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {team}
                  </span>
                  {rank !== null && (
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
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
