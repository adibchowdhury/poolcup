'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import {
  fetchMatchPoolPicks,
  type MatchPoolPick,
} from '@/src/lib/match-pool-picks'
import {
  getPredictionOutcome,
  getPredictionOutcomeLabel,
  type PredictionOutcomeKind,
} from '@/src/lib/prediction-scoring'
import { supabase } from '@/src/lib/supabase'

type MatchRoomPicksPanelProps = {
  poolId: string
  matchId: string
  currentUserId: string
  avatarsByMemberId: Map<string, string | null>
  isFinal: boolean
  resultTeam1: number | null
  resultTeam2: number | null
}

type EnrichedPick = MatchPoolPick & {
  statusLabel: string
  outcomeKind: PredictionOutcomeKind | 'pending'
  projectedPoints: number
}

function getLiveStatusLabel(kind: PredictionOutcomeKind): string {
  switch (kind) {
    case 'exact':
      return 'Exact'
    case 'winner':
      return 'Correct winner'
    case 'wrong':
      return 'Off'
  }
}

function enrichPick(
  pick: MatchPoolPick,
  isFinal: boolean,
  resultTeam1: number | null,
  resultTeam2: number | null,
): EnrichedPick {
  if (resultTeam1 == null || resultTeam2 == null) {
    return {
      ...pick,
      statusLabel: '—',
      outcomeKind: 'pending',
      projectedPoints: 0,
    }
  }

  const outcome = getPredictionOutcome(
    pick.predTeam1,
    pick.predTeam2,
    resultTeam1,
    resultTeam2,
  )

  return {
    ...pick,
    statusLabel: isFinal
      ? getPredictionOutcomeLabel(outcome.kind)
      : getLiveStatusLabel(outcome.kind),
    outcomeKind: outcome.kind,
    projectedPoints: isFinal ? (pick.points ?? outcome.points) : outcome.points,
  }
}

function getPillLabel(kind: PredictionOutcomeKind | 'pending'): string {
  switch (kind) {
    case 'exact':
      return 'Exact'
    case 'winner':
      return 'Winner'
    case 'wrong':
      return 'Off'
    case 'pending':
      return '—'
  }
}

function PickStatusPill({
  kind,
}: {
  kind: PredictionOutcomeKind | 'pending'
}) {
  const label = getPillLabel(kind)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        kind === 'exact' &&
          'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
        kind === 'winner' &&
          'border border-amber-500/40 bg-amber-500/15 text-amber-400',
        (kind === 'wrong' || kind === 'pending') &&
          'border border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

function PickAvatar({
  name,
  avatar,
  isYou,
}: {
  name: string
  avatar: string | null
  isYou: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold',
        isYou ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
      )}
    >
      {avatar ? (
        <Image
          src={getAvatarSrc(avatar)}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 object-cover object-top"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

export function MatchRoomLockTally({
  poolId,
  matchId,
  memberCount,
}: {
  poolId: string
  matchId: string
  memberCount: number
}) {
  const [lockedCount, setLockedCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCount() {
      const { count, error } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId)
        .eq('match_id', matchId)

      if (cancelled) return

      if (error) {
        console.error('Failed to load prediction tally:', error.message)
        setLockedCount(0)
        return
      }

      setLockedCount(count ?? 0)
    }

    void loadCount()

    return () => {
      cancelled = true
    }
  }, [poolId, matchId])

  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <p className="font-display text-lg tracking-wide text-foreground">
        Pool Picks
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Predictions lock at kickoff. Picks stay hidden until then.
      </p>
      <p className="mt-4 font-mono text-2xl font-bold tabular-nums text-primary">
        {lockedCount == null ? '—' : lockedCount}
        <span className="text-base font-normal text-muted-foreground">
          {' '}
          / {memberCount} locked in
        </span>
      </p>
    </div>
  )
}

function PickListItem({
  pick,
  rank,
  avatar,
  isYou,
}: {
  pick: EnrichedPick
  rank: number
  avatar: string | null
  isYou: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2.5 sm:gap-3',
        isYou ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted/30',
      )}
    >
      <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
        {rank}
      </span>
      <PickAvatar name={pick.displayName} avatar={avatar} isYou={isYou} />
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isYou ? 'font-semibold text-foreground' : 'text-foreground',
        )}
      >
        {pick.displayName}
        {isYou ? (
          <span className="ml-1.5 text-xs text-primary">(you)</span>
        ) : null}
      </p>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
        {pick.predTeam1}–{pick.predTeam2}
      </span>
      <PickStatusPill kind={pick.outcomeKind} />
      <span
        className={cn(
          'w-[3.25rem] shrink-0 text-right text-xs font-semibold tabular-nums',
          pick.projectedPoints > 0 ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {pick.projectedPoints > 0
          ? `+${pick.projectedPoints}`
          : '0'}
      </span>
    </li>
  )
}

export function MatchRoomPicksPanel({
  poolId,
  matchId,
  currentUserId,
  avatarsByMemberId,
  isFinal,
  resultTeam1,
  resultTeam2,
}: MatchRoomPicksPanelProps) {
  const [picks, setPicks] = useState<MatchPoolPick[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadPicks = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const result = await fetchMatchPoolPicks(supabase, poolId, matchId, {
      isFinal,
      resultTeam1,
      resultTeam2,
    })

    if (result.error) {
      setFetchError(result.error)
      setPicks([])
    } else {
      setPicks(result.picks)
    }

    setLoading(false)
  }, [poolId, matchId, isFinal, resultTeam1, resultTeam2])

  useEffect(() => {
    void loadPicks()
  }, [loadPicks])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadPicks()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [loadPicks])

  const enrichedPicks = useMemo(() => {
    if (!picks) return []

    return picks
      .map((pick) => enrichPick(pick, isFinal, resultTeam1, resultTeam2))
      .sort((a, b) => {
        if (b.projectedPoints !== a.projectedPoints) {
          return b.projectedPoints - a.projectedPoints
        }
        return a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        })
      })
  }, [picks, isFinal, resultTeam1, resultTeam2])

  const yourPick = enrichedPicks.find((pick) => pick.userId === currentUserId)
  const otherPicks = enrichedPicks.filter((pick) => pick.userId !== currentUserId)
  const yourPickRank =
    yourPick != null ? enrichedPicks.findIndex((pick) => pick.userId === currentUserId) + 1 : 0

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h3 className="font-display text-lg tracking-wide text-foreground">
          Pool Picks
        </h3>
        {isFinal ? (
          <span className="ml-auto text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Final
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
            <span className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
            Live
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-col p-2">
        {loading ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading picks…
          </p>
        ) : fetchError ? (
          <p className="px-3 py-8 text-center text-sm text-destructive">
            Could not load picks.
          </p>
        ) : enrichedPicks.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No predictions submitted for this match yet.
          </p>
        ) : (
          <>
            {yourPick ? (
              <div className="mb-2 shrink-0 border-b border-border/60 pb-2">
                <PickListItem
                  pick={yourPick}
                  rank={yourPickRank}
                  avatar={avatarsByMemberId.get(yourPick.memberId) ?? null}
                  isYou
                />
              </div>
            ) : null}

            <ul className="max-h-[min(24rem,45vh)] space-y-1 overflow-y-auto overscroll-contain pr-1">
              {otherPicks.map((pick) => (
                <PickListItem
                  key={pick.memberId}
                  pick={pick}
                  rank={
                    enrichedPicks.findIndex((p) => p.memberId === pick.memberId) + 1
                  }
                  avatar={avatarsByMemberId.get(pick.memberId) ?? null}
                  isYou={false}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
