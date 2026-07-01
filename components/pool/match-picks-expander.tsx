'use client'

import { useCallback, useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import {
  resolveAdvancePickFromScores,
  resolveAdvancePickTeamName,
} from '@/src/lib/knockout-match-prediction'
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
  round?: string
  advancingTeam?: number | null
  currentUserId: string
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
}

function PickRow({
  pick,
  isFinal,
  isYou,
  round,
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
}: {
  pick: MatchPoolPick
  isFinal: boolean
  isYou: boolean
  round?: string
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
}) {
  const showAdvancePick = round != null && isKnockoutRound(round)
  const effectivePick = showAdvancePick
    ? resolveAdvancePickFromScores(
        pick.predTeam1,
        pick.predTeam2,
        pick.advancePick,
      )
    : null
  const advanceName =
    effectivePick != null
      ? resolveAdvancePickTeamName(effectivePick, team1Name, team2Name)
      : null
  const advanceFlag =
    effectivePick === 1 ? team1Flag : effectivePick === 2 ? team2Flag : null

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
        <div className="flex min-w-0 flex-col items-end gap-0.5">
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {pick.predTeam1}–{pick.predTeam2}
          </span>
          {showAdvancePick ? (
            effectivePick != null && advanceName ? (
              <span className="inline-flex max-w-[8.5rem] items-center gap-1 text-[10px] text-muted-foreground sm:max-w-[10rem]">
                <TeamFlagImage
                  countryName={advanceName}
                  dbFlag={advanceFlag}
                  imgClassName="h-3 w-auto shrink-0 object-cover"
                  emojiClassName="text-[10px] leading-none"
                />
                <span className="truncate">{advanceName}</span>
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">No pick</span>
            )
          ) : null}
        </div>
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
  round,
  advancingTeam,
  currentUserId,
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
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
      round,
      advancingTeam,
    })

    if (result.error) {
      setFetchError(result.error)
      setPicks([])
    } else {
      setPicks(result.picks)
    }

    setLoading(false)
  }, [poolId, matchId, isFinal, resultTeam1, resultTeam2, scoringStyle, round, advancingTeam])

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
                  round={round}
                  team1Name={team1Name}
                  team2Name={team2Name}
                  team1Flag={team1Flag}
                  team2Flag={team2Flag}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
