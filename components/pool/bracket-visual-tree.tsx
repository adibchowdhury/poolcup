'use client'

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefCallback } from 'react'
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
import {
  getTeamRank,
  type GroupRankings,
  type WorldCupGroup,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'

const BRACKET_WRAPPER_STYLE: CSSProperties = {
  width: '100vw',
  position: 'relative',
  left: '50%',
  transform: 'translateX(-50%)',
  paddingLeft: 48,
  paddingRight: 48,
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
        'w-8 shrink-0 text-center font-mono text-xs font-semibold',
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
  readOnly,
  onTeamTap,
}: {
  team: string
  rank: number | null
  group: WorldCupGroupLetter
  registerRef?: RefCallback<HTMLElement>
  readOnly: boolean
  onTeamTap: () => void
}) {
  const flag = resolveTeamFlagDisplay(team, null)

  return (
    <button
      ref={registerRef}
      type="button"
      disabled={readOnly}
      onClick={onTeamTap}
      data-bracket-group={group}
      data-bracket-rank={rank ?? undefined}
      className={cn(
        'relative z-[1] flex h-9 w-full items-center gap-2 border-b border-[#1a2332] bg-[#111827] px-3 text-left last:border-b-0',
        rank === 1 && 'border-l-2 border-l-[#22c55e]',
        rank === 2 && 'border-l-2 border-l-[#22c55e]',
        rank === 3 && 'border-l-2 border-l-amber-500',
        rank === 4 && 'border-l-2 border-l-transparent opacity-45',
        rank === null && 'border-l-2 border-l-transparent',
        !readOnly && 'cursor-pointer transition-colors hover:bg-[#151d2e]',
        readOnly && 'cursor-default',
      )}
    >
      <span className="shrink-0 text-lg leading-none" aria-hidden>
        {flag}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-base font-medium',
          rank === 4 ? 'text-[#6b7280]' : 'text-[#e2e8f0]',
        )}
      >
        {team}
      </span>
      {rank !== null && <RankBadge rank={rank} />}
    </button>
  )
}

function BracketGroupCard({
  group,
  standings,
  registerTeamRef,
  align,
  readOnly,
  onTeamTap,
}: {
  group: WorldCupGroup
  standings: string[]
  registerTeamRef: (
    group: WorldCupGroupLetter,
    rank: 1 | 2,
  ) => RefCallback<HTMLElement>
  align: 'left' | 'right'
  readOnly: boolean
  onTeamTap: (teamName: string) => void
}) {
  return (
    <div
      className={cn(
        'relative z-[1] flex w-full flex-col',
        align === 'right' && 'items-end',
      )}
    >
      <p
        className={cn(
          'mb-1 w-full text-[10px] font-semibold uppercase tracking-wider text-[#22c55e]',
          align === 'right' ? 'text-right' : 'text-left',
        )}
      >
        Group {group.letter}
      </p>
      <div className="relative z-[1] w-full overflow-hidden rounded border border-[#1e293b]">
        {group.teams.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#64748b]">No teams loaded yet.</p>
        ) : (
          group.teams.map((team) => {
            const rank = getTeamRank(standings, team)
            return (
              <BracketTeamRow
                key={`${group.letter}-${team}`}
                team={team}
                rank={rank}
                group={group.letter}
                readOnly={readOnly}
                onTeamTap={() => onTeamTap(team)}
                registerRef={
                  rank === 1 || rank === 2
                    ? registerTeamRef(group.letter, rank)
                    : undefined
                }
              />
            )
          })
        )}
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
      className="relative z-[1] flex h-9 w-full items-center gap-2 rounded border border-dashed border-[#2a3545] bg-[#0a1018]/90 px-3"
    >
      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-[#334155]" />
      <span className="whitespace-nowrap text-[11px] text-[#4a5568]">TBD</span>
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
    <div className="flex w-full flex-col">
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
      className="flex w-full shrink-0 flex-col justify-between self-stretch py-0.5"
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
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
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
  groupRankings: GroupRankings
  readOnly: boolean
  onTeamTap: (groupLetter: WorldCupGroupLetter, teamName: string) => void
}

export function BracketVisualTree({
  groups,
  groupRankings,
  readOnly,
  onTeamTap,
}: BracketVisualTreeProps) {
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
  }, [updateConnectors, groups, groupRankings])

  function renderGroupCard(group: WorldCupGroup, align: 'left' | 'right') {
    const standings = groupRankings[group.letter] ?? []

    return (
      <BracketGroupCard
        key={group.letter}
        group={group}
        standings={standings}
        registerTeamRef={registerTeamRef}
        align={align}
        readOnly={readOnly}
        onTeamTap={(teamName) => onTeamTap(group.letter, teamName)}
      />
    )
  }

  return (
    <div style={BRACKET_WRAPPER_STYLE}>
      <div
        ref={containerRef}
        className="relative flex w-full items-stretch py-6"
        style={{ gap: BRACKET_LAYOUT.columnGap }}
      >
        <BracketConnectors paths={connectorPaths} />

        <div
          className="flex w-full shrink-0 flex-col items-start gap-2.5"
          style={{ width: BRACKET_LAYOUT.leftGroupColumnWidth }}
        >
          {leftGroups.map((group) => renderGroupCard(group, 'left'))}
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
          className="flex w-full shrink-0 flex-col items-end gap-2.5"
          style={{ width: BRACKET_LAYOUT.rightGroupColumnWidth }}
        >
          {rightGroups.map((group) => renderGroupCard(group, 'right'))}
        </div>
      </div>
    </div>
  )
}
