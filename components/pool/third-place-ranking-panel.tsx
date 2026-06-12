'use client'

import { cn } from '@/lib/utils'
import { rankOrdinal } from '@/src/lib/world-cup-2026-bracket'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  getTeamRank,
  getThirdPlaceSlots,
  THIRD_PLACE_LOCKED_LABEL,
  type GroupRankings,
} from '@/src/lib/world-cup-groups'

function ThirdPlaceRankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'shrink-0 text-center font-mono text-[9px] font-semibold leading-none',
        rank <= 8 && 'text-[#22c55e]',
        rank >= 9 && 'text-red-400',
      )}
    >
      {rankOrdinal(rank)}
    </span>
  )
}

function AdvancementBadge({ rank }: { rank: number }) {
  if (rank <= 8) {
    return (
      <span className="shrink-0 rounded-full bg-[#22c55e]/15 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-[#22c55e]">
        Advances
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-red-400">
      Eliminated
    </span>
  )
}

function ThirdPlacePlaceholderRow({ group }: { group: string }) {
  return (
    <div className="flex min-h-9 w-full items-start gap-2 border-b border-[#1a2332] border-l-2 border-l-transparent bg-[#111827]/60 px-3 py-2 last:border-b-0">
      <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-[#334155]" />
      <span className="flex-1 break-words text-sm leading-snug text-[#4a5568]">
        Group {group} — 3rd place TBD
      </span>
    </div>
  )
}

function ThirdPlaceTeamRow({
  team,
  group,
  rank,
  readOnly,
  onTeamTap,
}: {
  team: string
  group: string
  rank: number | null
  readOnly: boolean
  onTeamTap: () => void
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onTeamTap}
      className={cn(
        'relative z-[1] flex w-full gap-2 border-b border-[#1a2332] bg-[#111827] px-3 py-2 text-left last:border-b-0',
        rank !== null && rank <= 8 && 'border-l-2 border-l-[#22c55e]',
        rank !== null && rank >= 9 && 'border-l-2 border-l-red-500',
        rank === null && 'border-l-2 border-l-transparent',
        !readOnly && 'cursor-pointer transition-colors hover:bg-[#151d2e]',
        readOnly && 'cursor-default',
      )}
    >
      <TeamFlagImage
        countryName={team}
        imgClassName="h-5 w-auto"
        emojiClassName="text-lg leading-none"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="break-words text-sm font-medium leading-snug text-[#e2e8f0]">
          {team}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 font-mono text-[9px] text-[#64748b]">
            {group}
          </span>
          {rank !== null && (
            <>
              <ThirdPlaceRankBadge rank={rank} />
              <AdvancementBadge rank={rank} />
            </>
          )}
        </div>
      </div>
    </button>
  )
}

interface ThirdPlaceRankingPanelProps {
  groupRankings: GroupRankings
  thirdPlaceRankings: string[]
  readOnly?: boolean
  locked?: boolean
  /** Latest group-stage kickoff (ms); shown in the unlock heads-up notice. */
  lockKickoffAtMs?: number
  onThirdPlaceTeamTap: (teamName: string) => void
}

export function ThirdPlaceRankingPanel({
  groupRankings,
  thirdPlaceRankings,
  readOnly = false,
  locked = false,
  lockKickoffAtMs,
  onThirdPlaceTeamTap,
}: ThirdPlaceRankingPanelProps) {
  const slots = getThirdPlaceSlots(groupRankings)
  const pickedCount = Math.min(thirdPlaceRankings.length, 8)
  const interactionDisabled = readOnly || locked
  const lockDeadlineIso =
    lockKickoffAtMs != null
      ? new Date(lockKickoffAtMs).toISOString()
      : null

  return (
    <div className="relative z-[1] flex min-w-0 flex-1 flex-col self-stretch">
      {!locked && lockDeadlineIso && (
        <p className="mb-1 text-xs text-amber-400">
          Third-place rankings lock when the final group-stage match kicks off (
          <time dateTime={lockDeadlineIso}>
            {formatFeaturedKickoffLocal(lockDeadlineIso)}
          </time>
          ).
        </p>
      )}
      <div className="mb-1 flex w-full items-center justify-between gap-2">
        <p
          className={cn(
            'shrink-0 text-[10px] font-semibold uppercase tracking-wider',
            locked ? 'text-[#64748b]' : 'text-[#22c55e]',
          )}
        >
          3rd Place Teams
        </p>
        {locked && (
          <span className="shrink-0 text-right text-[10px] font-normal normal-case tracking-normal text-[#94a3b8]">
            {THIRD_PLACE_LOCKED_LABEL}
          </span>
        )}
      </div>
      <p className="mb-1 text-right font-mono text-[10px] text-[#64748b]">
        {pickedCount}/8 picked
      </p>
      <div
        className={cn(
          'relative z-[1] w-full overflow-hidden rounded border',
          locked ? 'border-[#334155]/90 bg-[#0f172a]/40' : 'border-[#1e293b]',
        )}
      >
        {locked && (
          <div
            className="pointer-events-none absolute inset-0 z-10 bg-[#0f172a]/35 ring-1 ring-inset ring-[#475569]/40"
            aria-hidden
          />
        )}
        {slots.map((slot) => {
          if (!slot.team) {
            return (
              <ThirdPlacePlaceholderRow
                key={slot.group}
                group={slot.group}
              />
            )
          }

          const rank = getTeamRank(thirdPlaceRankings, slot.team)
          return (
            <ThirdPlaceTeamRow
              key={slot.group}
              team={slot.team}
              group={slot.group}
              rank={rank}
              readOnly={interactionDisabled}
              onTeamTap={() => onThirdPlaceTeamTap(slot.team!)}
            />
          )
        })}
      </div>
    </div>
  )
}
