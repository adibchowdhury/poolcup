'use client'

import { useCallback, useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  fetchMatchPoolPicks,
  type MatchPoolPick,
} from '@/src/lib/match-pool-picks'
import type { MatchScoringStyle } from '@/src/lib/prediction-scoring'
import { supabase } from '@/src/lib/supabase'

type MatchPicksExpanderProps = {
  poolId: string
  matchId: string
  scoringStyle: MatchScoringStyle
  kickoffAt: string
  isFinal: boolean
  resultTeam1: number | null
  resultTeam2: number | null
  currentUserId: string
}

function PickRow({
  pick,
  isFinal,
  isYou,
}: {
  pick: MatchPoolPick
  isFinal: boolean
  isYou: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5',
        isYou ? 'bg-primary/10' : 'bg-muted/40',
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate text-sm',
          isYou ? 'font-medium text-foreground' : 'text-foreground',
        )}
      >
        {pick.displayName}
        {isYou ? (
          <span className="ml-1.5 text-xs text-primary">(you)</span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {pick.predTeam1}–{pick.predTeam2}
        </span>
        {isFinal && pick.points != null ? (
          <span
            className={cn(
              'min-w-[3rem] text-right text-xs font-semibold tabular-nums',
              pick.points > 0 ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            +{pick.points} pts
          </span>
        ) : null}
      </div>
    </li>
  )
}

export function MatchPicksExpander({
  poolId,
  matchId,
  scoringStyle,
  kickoffAt,
  isFinal,
  resultTeam1,
  resultTeam2,
  currentUserId,
}: MatchPicksExpanderProps) {
  const { mounted, nowMs } = useClientNow(30_000)
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState<MatchPoolPick[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const hasKickedOff =
    mounted && new Date(kickoffAt).getTime() <= nowMs

  const loadPicks = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const result = await fetchMatchPoolPicks(supabase, poolId, matchId, {
      isFinal,
      resultTeam1,
      resultTeam2,
      scoringStyle,
    })

    if (result.error) {
      setFetchError(result.error)
      setPicks([])
    } else {
      setPicks(result.picks)
    }

    setLoading(false)
  }, [poolId, matchId, isFinal, resultTeam1, resultTeam2, scoringStyle])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && picks === null && !loading) {
      void loadPicks()
    }
  }

  if (!hasKickedOff) {
    return null
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          See everyone&apos;s picks
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <div className="pt-2">
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Loading picks…
            </p>
          ) : fetchError ? (
            <p className="px-3 py-4 text-center text-sm text-destructive">
              Could not load picks.
            </p>
          ) : picks && picks.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No predictions submitted for this match yet.
            </p>
          ) : picks ? (
            <ul className="space-y-1.5">
              {picks.map((pick) => (
                <PickRow
                  key={pick.memberId}
                  pick={pick}
                  isFinal={isFinal}
                  isYou={pick.userId === currentUserId}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
