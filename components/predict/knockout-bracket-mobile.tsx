'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import type { KnockoutBracketTabId } from '@/components/predict/knockout-bracket-preview'
import type { R32BracketInteractiveProps } from '@/components/predict/knockout-bracket-preview'
import {
  isResolvedR32Team,
  R32_PREVIEW_SLOT_TO_MATCH_NUMBER,
} from '@/src/lib/r32-bracket-preview'
import {
  countR32AdvancePicks,
  getR16ProjectedSides,
  getR32R16AdvanceHint,
  isR32PickPersisted,
  WINNER_ONLY_KNOCKOUT_PICK_TOTALS,
  type R32BracketMatchView,
} from '@/src/lib/winner-only-r32-bracket'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import type { BracketSide } from '@/src/lib/world-cup-2026-bracket'

type R32MobileFilter = 'all' | 'remaining' | 'completed'

type R32Slot = (typeof R32_PREVIEW_SLOT_TO_MATCH_NUMBER)[number]

function isR32MatchPicked(match: R32BracketMatchView | undefined): boolean {
  return match?.myPick === 1 || match?.myPick === 2
}

function labelForKnockoutRound(
  round: 'r16' | 'qf' | 'sf' | 'final',
  half: BracketSide,
  index: number,
): string {
  switch (round) {
    case 'r16':
      return half === 'left' ? `R16 M${index + 1}` : `R16 M${index + 5}`
    case 'qf':
      return half === 'left' ? `QF M${index + 1}` : `QF M${index + 3}`
    case 'sf':
      return half === 'left' ? 'SF M1' : 'SF M2'
    case 'final':
      return 'Final'
  }
}

function roundDisplayLabel(round: 'r16' | 'qf' | 'sf' | 'final'): string {
  return TOURNAMENT_ROUND_LABELS[round]
}

function MobileTeamName({
  name,
  compact = false,
}: {
  name: string | null | undefined
  compact?: boolean
}) {
  const normalized = (name ?? '').trim()
  if (!normalized || !isResolvedR32Team(normalized)) {
    return (
      <span
        className={cn(
          'truncate text-muted-foreground',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        TBD
      </span>
    )
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <TeamFlagImage
        countryName={normalized}
        imgClassName="h-3.5 w-auto max-w-[1rem] shrink-0 object-contain"
        emojiClassName="text-sm leading-none"
      />
      <span
        className={cn(
          'min-w-0 truncate font-medium text-foreground',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        {normalized}
      </span>
    </span>
  )
}

function KnockoutMobileReadOnlyCard({
  matchLabel,
  roundLabel,
  homeName,
  awayName,
}: {
  matchLabel: string
  roundLabel: string
  homeName?: string | null
  awayName?: string | null
}) {
  return (
    <article
      className="w-full min-w-0 rounded-lg border border-[#1e293b]/90 bg-[#0a1018]/60 px-3 py-2.5 opacity-95"
      aria-label={`${matchLabel} locked preview`}
    >
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            {matchLabel} · {roundLabel}
          </p>
        </div>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
          Locked
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <MobileTeamName name={homeName} />
        </div>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#475569]">
          VS
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex justify-end">
            <MobileTeamName name={awayName} />
          </div>
        </div>
      </div>
    </article>
  )
}

function R32MobileGameCard({
  slot,
  match,
  r32Bracket,
  expanded,
  onToggleExpand,
  registerRef,
}: {
  slot: R32Slot
  match: R32BracketMatchView | undefined
  r32Bracket: R32BracketInteractiveProps
  expanded: boolean
  onToggleExpand: () => void
  registerRef?: (el: HTMLElement | null) => void
}) {
  const { nowMs, onAdvancePick } = r32Bracket
  const locked =
    match?.lockedAt != null &&
    new Date(match.lockedAt).getTime() <= nowMs
  const myPick = match?.myPick ?? null
  const hasPick = myPick === 1 || myPick === 2
  const hasPersistedPick =
    isR32PickPersisted(match) && match?.myPick === match?.savedPick
  const team1 = (match?.team1Name ?? '').trim()
  const team2 = (match?.team2Name ?? '').trim()
  const team1Resolved = isResolvedR32Team(team1)
  const team2Resolved = isResolvedR32Team(team2)
  const winnerName =
    hasPick && match
      ? myPick === 1
        ? team1
        : team2
      : null
  const loserName =
    hasPick && match
      ? myPick === 1
        ? team2
        : team1
      : null
  const canPick = Boolean(match) && !locked
  const advanceHint =
    hasPick && match
      ? getR32R16AdvanceHint(slot.half, slot.index, r32Bracket.matchesByNumber)
      : null
  const matchNum = slot.visualLabel.replace(/^M/, '')
  const isCollapsed = (hasPick || locked) && !expanded

  if (isCollapsed && winnerName && loserName) {
    return (
      <button
        type="button"
        ref={registerRef}
        onClick={locked ? undefined : onToggleExpand}
        disabled={locked}
        className={cn(
          'flex w-full min-w-0 flex-col rounded-lg border border-[#1e293b]/80 bg-[#0a1018]/80 px-3 py-2 text-left transition-colors',
          locked ? 'opacity-80' : 'hover:border-primary/30 active:bg-[#0f172a]',
        )}
        style={{ minHeight: '2.75rem' }}
        aria-label={`${slot.visualLabel} pick: ${winnerName} over ${loserName}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {hasPersistedPick ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          ) : null}
          <TeamFlagImage
            countryName={winnerName}
            imgClassName="h-3.5 w-auto max-w-[1rem] shrink-0 object-contain"
            emojiClassName="text-sm leading-none"
          />
          <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
            {winnerName}{' '}
            <span className="font-normal text-muted-foreground">over</span>{' '}
            {loserName}
          </span>
        </div>
        {advanceHint ? (
          <p className="mt-0.5 truncate pl-5 text-[9px] text-muted-foreground">
            {advanceHint}
          </p>
        ) : null}
      </button>
    )
  }

  return (
    <article
      ref={registerRef}
      className="w-full min-w-0 rounded-lg border border-[#1e293b]/90 bg-[#0a1018]/60 px-3 py-2 shadow-sm"
      aria-label={`${slot.visualLabel} matchup`}
    >
      <div className="mb-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            M{matchNum} · {TOURNAMENT_ROUND_LABELS.r32}
          </p>
          {locked ? (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
              Locked
            </span>
          ) : null}
        </div>
        <p className="truncate text-[9px] text-muted-foreground">
          Winner advances to {TOURNAMENT_ROUND_LABELS.r16}
        </p>
      </div>

      {hasPick && winnerName && loserName ? (
        <div className="space-y-1">
          <div className="flex min-w-0 items-center gap-2 rounded border border-primary bg-primary/15 px-2 py-1.5">
            {hasPersistedPick ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            ) : null}
            <TeamFlagImage
              countryName={winnerName}
              imgClassName="h-3.5 w-auto max-w-[1rem] shrink-0 object-contain"
              emojiClassName="text-sm leading-none"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-primary">
              {winnerName}
            </span>
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-primary">
              Advancing
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2 px-2 py-1 opacity-50">
            <TeamFlagImage
              countryName={loserName}
              imgClassName="h-3.5 w-auto max-w-[1rem] shrink-0 object-contain"
              emojiClassName="text-sm leading-none"
            />
            <span className="min-w-0 truncate text-[11px] text-[#94a3b8]">
              {loserName}
            </span>
          </div>
          {advanceHint ? (
            <p className="px-0.5 text-[9px] text-muted-foreground">{advanceHint}</p>
          ) : null}
        </div>
      ) : (
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <MobileTeamName name={team1Resolved ? team1 : null} />
          </div>
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#475569]">
            VS
          </span>
          <div className="min-w-0 flex-1 text-right">
            <div className="flex justify-end">
              <MobileTeamName name={team2Resolved ? team2 : null} />
            </div>
          </div>
        </div>
      )}

      {canPick && match ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onAdvancePick(match.matchId, 1)}
            disabled={!team1Resolved}
            className={cn(
              'min-w-0 flex-1 truncate rounded border px-2 py-1.5 text-[10px] font-semibold transition-colors',
              myPick === 1
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:border-primary/40',
              !team1Resolved && 'cursor-not-allowed opacity-50',
            )}
          >
            Pick {team1Resolved ? team1 : 'TBD'}
          </button>
          <button
            type="button"
            onClick={() => onAdvancePick(match.matchId, 2)}
            disabled={!team2Resolved}
            className={cn(
              'min-w-0 flex-1 truncate rounded border px-2 py-1.5 text-[10px] font-semibold transition-colors',
              myPick === 2
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:border-primary/40',
              !team2Resolved && 'cursor-not-allowed opacity-50',
            )}
          >
            Pick {team2Resolved ? team2 : 'TBD'}
          </button>
        </div>
      ) : null}

      {hasPick && !locked ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-1.5 w-full text-center text-[9px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Collapse
        </button>
      ) : null}
    </article>
  )
}

const R32_FILTER_OPTIONS: Array<{ id: R32MobileFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'remaining', label: 'Remaining' },
  { id: 'completed', label: 'Completed' },
]

function R32MobileGameCardPicker({
  r32Bracket,
}: {
  r32Bracket: R32BracketInteractiveProps
}) {
  const [filter, setFilter] = useState<R32MobileFilter>('all')
  const [expandedMatchNumber, setExpandedMatchNumber] = useState<number | null>(
    null,
  )
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map())

  const pickCount = useMemo(
    () => countR32AdvancePicks(r32Bracket.matchesByNumber),
    [r32Bracket.matchesByNumber],
  )
  const total = WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32
  const allComplete = pickCount >= total

  const sortedSlots = useMemo(() => {
    const slots = [...R32_PREVIEW_SLOT_TO_MATCH_NUMBER]
    return slots.sort((a, b) => {
      const aPicked = isR32MatchPicked(
        r32Bracket.matchesByNumber.get(a.matchNumber),
      )
      const bPicked = isR32MatchPicked(
        r32Bracket.matchesByNumber.get(b.matchNumber),
      )
      if (aPicked !== bPicked) return aPicked ? 1 : -1
      return a.matchNumber - b.matchNumber
    })
  }, [r32Bracket.matchesByNumber])

  const visibleSlots = useMemo(() => {
    return sortedSlots.filter((slot) => {
      const picked = isR32MatchPicked(
        r32Bracket.matchesByNumber.get(slot.matchNumber),
      )
      if (filter === 'remaining') return !picked
      if (filter === 'completed') return picked
      return true
    })
  }, [filter, sortedSlots, r32Bracket.matchesByNumber])

  const scrollToNextUnpicked = useCallback(() => {
    const next = sortedSlots.find(
      (slot) =>
        !isR32MatchPicked(r32Bracket.matchesByNumber.get(slot.matchNumber)),
    )
    if (!next) return
    const el = cardRefs.current.get(next.matchNumber)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sortedSlots, r32Bracket.matchesByNumber])

  const handlePickSide = useCallback(
    (matchId: string, pick: 1 | 2) => {
      r32Bracket.onAdvancePick(matchId, pick)
      const match = [...r32Bracket.matchesByNumber.values()].find(
        (row) => row.matchId === matchId,
      )
      if (match) {
        setExpandedMatchNumber(null)
      }
    },
    [r32Bracket],
  )

  const bracketWithCollapse = useMemo<R32BracketInteractiveProps>(
    () => ({
      ...r32Bracket,
      onAdvancePick: handlePickSide,
    }),
    [handlePickSide, r32Bracket],
  )

  return (
    <>
      <div className="flex gap-1.5">
        {R32_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
              filter === option.id
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-[#1e293b] text-muted-foreground hover:border-primary/30',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2">
        {visibleSlots.map((slot) => {
          const match = r32Bracket.matchesByNumber.get(slot.matchNumber)
          const expanded = expandedMatchNumber === slot.matchNumber

          return (
            <R32MobileGameCard
              key={slot.matchNumber}
              slot={slot}
              match={match}
              r32Bracket={bracketWithCollapse}
              expanded={expanded}
              onToggleExpand={() =>
                setExpandedMatchNumber((prev) =>
                  prev === slot.matchNumber ? null : slot.matchNumber,
                )
              }
              registerRef={(el) => {
                if (el) cardRefs.current.set(slot.matchNumber, el)
                else cardRefs.current.delete(slot.matchNumber)
              }}
            />
          )
        })}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            <span className="font-mono text-primary">{pickCount}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="font-mono">{total}</span>
            <span className="text-muted-foreground"> complete</span>
          </p>
          {!allComplete ? (
            <button
              type="button"
              onClick={scrollToNextUnpicked}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function KnockoutBracketMobileList({
  tab,
  r32Bracket,
}: {
  tab: KnockoutBracketTabId
  r32Bracket?: R32BracketInteractiveProps
}) {
  if (tab === 'r32') {
    if (!r32Bracket) return null
    return <R32MobileGameCardPicker r32Bracket={r32Bracket} />
  }

  if (tab === 'r16') {
    const slots: Array<{ half: BracketSide; index: number }> = [
      ...Array.from({ length: 4 }, (_, index) => ({
        half: 'left' as const,
        index,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        half: 'right' as const,
        index,
      })),
    ]

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {slots.map(({ half, index }) => {
          const { home, away } = r32Bracket
            ? getR16ProjectedSides(half, index, r32Bracket.matchesByNumber)
            : { home: null, away: null }

          return (
            <KnockoutMobileReadOnlyCard
              key={`${half}-r16-${index}`}
              matchLabel={labelForKnockoutRound('r16', half, index)}
              roundLabel={roundDisplayLabel('r16')}
              homeName={home}
              awayName={away}
            />
          )
        })}
      </div>
    )
  }

  if (tab === 'qf') {
    const slots: Array<{ half: BracketSide; index: number }> = [
      { half: 'left', index: 0 },
      { half: 'left', index: 1 },
      { half: 'right', index: 0 },
      { half: 'right', index: 1 },
    ]

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {slots.map(({ half, index }) => (
          <KnockoutMobileReadOnlyCard
            key={`${half}-qf-${index}`}
            matchLabel={labelForKnockoutRound('qf', half, index)}
            roundLabel={roundDisplayLabel('qf')}
          />
        ))}
      </div>
    )
  }

  if (tab === 'sf') {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <KnockoutMobileReadOnlyCard
          matchLabel="SF M1"
          roundLabel={roundDisplayLabel('sf')}
        />
        <KnockoutMobileReadOnlyCard
          matchLabel="SF M2"
          roundLabel={roundDisplayLabel('sf')}
        />
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <KnockoutMobileReadOnlyCard
        matchLabel="Final"
        roundLabel={roundDisplayLabel('final')}
      />
    </div>
  )
}
