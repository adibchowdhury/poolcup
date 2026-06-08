'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from 'react'
import { cn } from '@/lib/utils'
import { resolveTeamFlagDisplay } from '@/src/lib/team-flags'
import {
  BRACKET_LAYOUT,
  GROUP_ADVANCE_FEEDS,
  LEFT_GROUP_LETTERS,
  R32_LEFT,
  R32_RIGHT,
  RIGHT_GROUP_LETTERS,
  groupSourceKey,
  isLeftGroup,
  rankOrdinal,
  r32TargetKey,
  type R32MatchupDef,
  type R32SlotRef,
} from '@/src/lib/world-cup-2026-bracket'
import type { WorldCupGroup, WorldCupGroupLetter } from '@/src/lib/world-cup-groups'

const BRACKET_WRAPPER_STYLE: CSSProperties = {
  width: '100vw',
  position: 'relative',
  left: '50%',
  transform: 'translateX(-50%)',
  boxSizing: 'border-box',
}

type ConnectorPath = {
  id: string
  d: string
}

function connectorPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midX = fromX + (toX - fromX) * 0.55
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'w-7 shrink-0 text-center font-mono text-[10px] font-semibold',
        rank <= 2 && 'text-[#22c55e]',
        rank === 3 && 'text-amber-400',
        rank === 4 && 'text-[#4a5568]',
      )}
    >
      {rankOrdinal(rank)}
    </span>
  )
}

function BracketTeamRow({
  team,
  rank,
  group,
  registerRef,
}: {
  team: string
  rank: number
  group: WorldCupGroupLetter
  registerRef?: RefCallback<HTMLElement>
}) {
  const flag = resolveTeamFlagDisplay(team, null)

  return (
    <div
      ref={registerRef}
      data-bracket-group={group}
      data-bracket-rank={rank}
      className={cn(
        'flex h-7 items-center gap-1.5 border-b border-[#1a2332] bg-[#111827] px-1.5 last:border-b-0',
        rank <= 2 && 'border-l-2 border-l-[#22c55e]',
        rank === 3 && 'border-l-2 border-l-amber-500',
        rank === 4 && 'border-l-2 border-l-transparent opacity-45',
      )}
    >
      <RankBadge rank={rank} />
      <span className="shrink-0 text-sm leading-none" aria-hidden>
        {flag}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs font-medium',
          rank === 4 ? 'text-[#6b7280]' : 'text-[#e2e8f0]',
        )}
      >
        {team}
      </span>
    </div>
  )
}

function BracketGroupCard({
  group,
  registerTeamRef,
}: {
  group: WorldCupGroup
  registerTeamRef: (
    group: WorldCupGroupLetter,
    rank: 1 | 2,
  ) => RefCallback<HTMLElement>
}) {
  const teams =
    group.teams.length >= 4
      ? group.teams.slice(0, 4)
      : [
          ...group.teams,
          ...Array.from({ length: Math.max(0, 4 - group.teams.length) }, () => 'TBD'),
        ]

  return (
    <div className="w-full">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#22c55e]">
        Group {group.letter}
      </p>
      <div className="overflow-hidden rounded border border-[#1e293b]">
        {teams.map((team, index) => {
          const rank = index + 1
          const advanceRank = rank === 1 || rank === 2 ? rank : null
          return (
            <BracketTeamRow
              key={`${group.letter}-${index}`}
              team={team}
              rank={rank}
              group={group.letter}
              registerRef={
                advanceRank
                  ? registerTeamRef(group.letter, advanceRank)
                  : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function R32PlaceholderSlot({
  slotRef,
}: {
  slotRef: RefCallback<HTMLElement>
}) {
  return (
    <div
      ref={slotRef}
      className="flex h-7 w-full items-center gap-1.5 rounded border border-dashed border-[#2a3545] bg-[#0a1018]/90 px-2"
    >
      <span className="h-3 w-3 shrink-0 rounded-full border border-dashed border-[#334155]" />
      <span className="truncate text-[11px] text-[#4a5568]">TBD</span>
    </div>
  )
}

function R32MatchupBlock({
  matchup,
  side,
  matchIndex,
  registerSlotRef,
}: {
  matchup: R32MatchupDef
  side: 'left' | 'right'
  matchIndex: number
  registerSlotRef: (target: R32SlotRef) => RefCallback<HTMLElement>
}) {
  const homeTarget: R32SlotRef = { side, matchIndex, slot: 'home' }
  const awayTarget: R32SlotRef = { side, matchIndex, slot: 'away' }

  return (
    <div className="w-full">
      <p className="mb-1 text-center font-mono text-[10px] text-[#64748b]">
        {matchup.label}
      </p>
      <R32PlaceholderSlot slotRef={registerSlotRef(homeTarget)} />
      <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
        vs
      </p>
      <R32PlaceholderSlot slotRef={registerSlotRef(awayTarget)} />
    </div>
  )
}

function R32Column({
  side,
  matchups,
  registerSlotRef,
  width,
}: {
  side: 'left' | 'right'
  matchups: R32MatchupDef[]
  registerSlotRef: (target: R32SlotRef) => RefCallback<HTMLElement>
  width: string
}) {
  return (
    <div
      className="flex shrink-0 flex-col justify-between self-stretch py-0.5"
      style={{ width }}
    >
      {matchups.map((matchup, index) => (
        <R32MatchupBlock
          key={matchup.matchNumber}
          matchup={matchup}
          side={side}
          matchIndex={index}
          registerSlotRef={registerSlotRef}
        />
      ))}
    </div>
  )
}

function CenterDivider({ width }: { width: string }) {
  return (
    <div
      className="flex shrink-0 flex-col items-center self-stretch px-1"
      style={{ width }}
    >
      <div className="w-px flex-1 bg-[#2a3545]" />
      <p className="my-4 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22c55e]">
        Round of 32
      </p>
      <div className="w-px flex-1 bg-[#2a3545]" />
    </div>
  )
}

function BracketConnectors({ paths }: { paths: ConnectorPath[] }) {
  if (paths.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={BRACKET_LAYOUT.connectorColor}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}

interface BracketVisualTreeProps {
  groups: WorldCupGroup[]
}

export function BracketVisualTree({ groups }: BracketVisualTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sourceRefs = useRef(new Map<string, HTMLElement>())
  const targetRefs = useRef(new Map<string, HTMLElement>())
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([])

  const groupByLetter = new Map(groups.map((group) => [group.letter, group]))

  const leftGroups = LEFT_GROUP_LETTERS.map(
    (letter) =>
      groupByLetter.get(letter) ?? { letter, teams: [] },
  )
  const rightGroups = RIGHT_GROUP_LETTERS.map(
    (letter) =>
      groupByLetter.get(letter) ?? { letter, teams: [] },
  )

  const registerTeamRef = useCallback(
    (group: WorldCupGroupLetter, rank: 1 | 2): RefCallback<HTMLElement> =>
      (element) => {
        const key = groupSourceKey(group, rank)
        if (element) sourceRefs.current.set(key, element)
        else sourceRefs.current.delete(key)
      },
    [],
  )

  const registerSlotRef = useCallback(
    (target: R32SlotRef): RefCallback<HTMLElement> => (element) => {
      const key = r32TargetKey(target)
      if (element) targetRefs.current.set(key, element)
      else targetRefs.current.delete(key)
    },
    [],
  )

  const updateConnectors = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const nextPaths: ConnectorPath[] = []

    for (const feed of GROUP_ADVANCE_FEEDS) {
      const sourceKey = groupSourceKey(feed.group, feed.rank)
      const targetKey = r32TargetKey(feed.target)
      const sourceEl = sourceRefs.current.get(sourceKey)
      const targetEl = targetRefs.current.get(targetKey)
      if (!sourceEl || !targetEl) continue

      const sourceRect = sourceEl.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()
      const fromLeftGroup = isLeftGroup(feed.group)

      const fromX = fromLeftGroup
        ? sourceRect.right - containerRect.left
        : sourceRect.left - containerRect.left
      const fromY =
        sourceRect.top + sourceRect.height / 2 - containerRect.top

      const toLeftEdge = feed.target.side === 'left'
      const toX = toLeftEdge
        ? targetRect.left - containerRect.left
        : targetRect.right - containerRect.left
      const toY =
        targetRect.top + targetRect.height / 2 - containerRect.top

      nextPaths.push({
        id: `${sourceKey}-${targetKey}`,
        d: connectorPath(fromX, fromY, toX, toY),
      })
    }

    setConnectorPaths(nextPaths)
  }, [])

  useLayoutEffect(() => {
    updateConnectors()

    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(updateConnectors)
    observer.observe(container)

    window.addEventListener('resize', updateConnectors)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateConnectors)
    }
  }, [updateConnectors, groups])

  return (
    <div style={BRACKET_WRAPPER_STYLE}>
      <div
        ref={containerRef}
        className="relative flex items-stretch py-6"
        style={{
          width: '100vw',
          gap: BRACKET_LAYOUT.columnGap,
        }}
      >
        <BracketConnectors paths={connectorPaths} />

        <div
          className="flex shrink-0 flex-col gap-2.5"
          style={{ width: BRACKET_LAYOUT.leftGroupColumnWidth }}
        >
          {leftGroups.map((group) => (
            <BracketGroupCard
              key={group.letter}
              group={group}
              registerTeamRef={registerTeamRef}
            />
          ))}
        </div>

        <R32Column
          side="left"
          matchups={R32_LEFT}
          registerSlotRef={registerSlotRef}
          width={BRACKET_LAYOUT.leftR32ColumnWidth}
        />

        <CenterDivider width={BRACKET_LAYOUT.centerDividerWidth} />

        <R32Column
          side="right"
          matchups={R32_RIGHT}
          registerSlotRef={registerSlotRef}
          width={BRACKET_LAYOUT.rightR32ColumnWidth}
        />

        <div
          className="flex shrink-0 flex-col gap-2.5"
          style={{ width: BRACKET_LAYOUT.rightGroupColumnWidth }}
        >
          {rightGroups.map((group) => (
            <BracketGroupCard
              key={group.letter}
              group={group}
              registerTeamRef={registerTeamRef}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
