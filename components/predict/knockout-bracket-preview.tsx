'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefCallback,
  type RefObject,
} from 'react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import { BRACKET_LAYOUT } from '@/src/lib/world-cup-2026-bracket'
import {
  isResolvedR32Team,
  r32MatchNumberForPreviewSlot,
} from '@/src/lib/r32-bracket-preview'
import {
  getKnockoutMatchForVisualSlot,
  getR16ProjectedSides,
  type R32BracketMatchView,
  type WinnerKnockoutDisplayRound,
} from '@/src/lib/winner-only-r32-bracket'
import { formatKickoffCompactOrNull } from '@/src/lib/match-kickoff-display'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'
import { KnockoutBracketMobileList } from '@/components/predict/knockout-bracket-mobile'

export type R32BracketInteractiveProps = {
  matchesByNumber: Map<number, R32BracketMatchView>
  nowMs: number
  onAdvancePick: (matchId: string, pick: 1 | 2) => void
}

/** Alias — same shape for R16 and other knockout pick rounds. */
export type KnockoutRoundBracketProps = R32BracketInteractiveProps

const CONNECTOR_COLOR = BRACKET_LAYOUT.connectorColor

const BRACKET_SCROLL_STYLE: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
}

/** Centers the bracket when it fits; when wider than the viewport, margins collapse so both edges scroll. */
const BRACKET_CENTER_STYLE: CSSProperties = {
  width: 'max-content',
  marginInline: 'auto',
}

/** Minimum width so columns + connectors stay readable inside horizontal scroll. */
const BRACKET_INNER_MIN_WIDTH = 720

export type KnockoutPreviewRound = 'r32' | 'r16' | 'qf' | 'sf'

export type KnockoutTabRoundPair = {
  sourceRound: KnockoutPreviewRound
  targetRound: Exclude<KnockoutPreviewRound, 'r32'>
}

export type KnockoutBracketPreviewProps = KnockoutTabRoundPair & {
  r32Bracket?: R32BracketInteractiveProps
  /** Real DB rows for the source round when source is r16 or qf. */
  sourceBracket?: KnockoutRoundBracketProps
  /** @deprecated Prefer sourceBracket */
  r16Bracket?: KnockoutRoundBracketProps
}

type BracketHalf = 'left' | 'right'
type ConnectorPath = { id: string; d: string }

const MATCHUPS_PER_SIDE: Record<KnockoutPreviewRound, number> = {
  r32: 8,
  r16: 4,
  qf: 2,
  sf: 1,
}

function matchupsPerSide(round: KnockoutPreviewRound): number {
  return MATCHUPS_PER_SIDE[round]
}

function matchupKey(
  half: BracketHalf,
  round: string,
  index: number,
): string {
  return `${half}-${round}-${index}`
}

function labelForMatchup(
  round: KnockoutPreviewRound,
  half: BracketHalf,
  index: number,
): string {
  switch (round) {
    case 'r32':
      return half === 'left' ? `M${index + 1}` : `M${index + 9}`
    case 'r16':
      return half === 'left' ? `R16 M${index + 1}` : `R16 M${index + 5}`
    case 'qf':
      return half === 'left' ? `QF M${index + 1}` : `QF M${index + 3}`
    case 'sf':
      return half === 'left' ? 'SF M1' : 'SF M2'
    default:
      return `M${index + 1}`
  }
}

export function TbdSlot() {
  return (
    <div
      aria-hidden
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded border border-dashed border-[#2a3545] bg-[#0a1018]/90 px-3"
    >
      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-[#334155]" />
      <span className="truncate text-[11px] text-[#4a5568]">TBD</span>
    </div>
  )
}

function ToBeDecidedSideSlot() {
  return (
    <div
      aria-hidden
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded border border-dashed border-[#2a3545] bg-[#0a1018]/40 px-3 opacity-95"
    >
      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-[#334155]" />
      <span className="truncate text-[11px] text-[#64748b]">To be decided</span>
    </div>
  )
}

function BracketPreviewTeamSlot({
  name,
  selected = false,
  dimmed = false,
  onClick,
}: {
  name: string
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}) {
  const className = cn(
    'flex h-9 w-full min-w-0 items-center gap-2 rounded border px-3 transition-colors',
    selected
      ? 'border-primary bg-primary/15'
      : 'border-[#1e293b] bg-[#111827]',
    dimmed && 'opacity-50',
    onClick && 'cursor-pointer hover:border-primary/40',
  )

  const content = (
    <>
      <TeamFlagImage
        countryName={name}
        imgClassName="h-4 w-auto max-w-[1.25rem] shrink-0 object-contain"
        emojiClassName="text-base leading-none"
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight',
          selected ? 'text-primary' : 'text-[#e2e8f0]',
        )}
      >
        {name}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-pressed={selected}
      >
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function BracketPreviewSideSlot({
  name,
  selected = false,
  dimmed = false,
  onSelect,
}: {
  name: string | null | undefined
  selected?: boolean
  dimmed?: boolean
  onSelect?: () => void
}) {
  const normalizedName = (name ?? '').trim()
  if (!isResolvedR32Team(normalizedName)) {
    return <TbdSlot />
  }

  return (
    <BracketPreviewTeamSlot
      name={normalizedName}
      selected={selected}
      dimmed={dimmed}
      onClick={onSelect}
    />
  )
}

function ProjectedR16MatchupBlock({
  label,
  registerRef,
  homeName,
  awayName,
}: {
  label: string
  registerRef?: RefCallback<HTMLElement>
  homeName: string | null
  awayName: string | null
}) {
  return (
    <article
      className="flex w-full min-w-0 flex-col opacity-95"
      aria-label={`${label} projected preview`}
    >
      <div className="mb-1 flex min-w-0 items-center justify-center gap-1 px-0.5">
        <p className="truncate text-center text-[8px] font-semibold uppercase tracking-wide text-[#64748b] sm:text-[9px] min-[1100px]:text-[10px]">
          {label}
        </p>
        <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-[#64748b]">
          Locked
        </span>
      </div>
      <div
        ref={registerRef}
        className="w-full min-w-0 rounded-md border border-[#1e293b]/90 bg-[#0a1018]/60 px-2 py-1.5 shadow-sm"
      >
        <BracketPreviewSideSlot name={homeName} />
        <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
          vs
        </p>
        <BracketPreviewSideSlot name={awayName} />
      </div>
    </article>
  )
}

function StaticKnockoutMatchupBlock({
  label,
  registerRef,
}: {
  label: string
  registerRef?: RefCallback<HTMLElement>
}) {
  return (
    <article className="flex w-full min-w-0 flex-col" aria-label={`${label} preview`}>
      <p className="mb-1 truncate px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[#64748b] sm:text-[9px] min-[1100px]:text-[10px]">
        {label}
      </p>
      <div
        ref={registerRef}
        className="w-full min-w-0 rounded-md border border-[#1e293b]/90 bg-[#0a1018]/60 px-2 py-1.5 shadow-sm"
      >
        <TbdSlot />
        <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
          vs
        </p>
        <TbdSlot />
      </div>
    </article>
  )
}

function KnockoutMatchKickoffLine({
  kickoffAt,
}: {
  kickoffAt: string | null | undefined
}) {
  const formatted = formatKickoffCompactOrNull(kickoffAt)
  if (!formatted) return null

  return (
    <p className="mb-0.5 truncate px-0.5 text-center text-[8px] leading-tight text-[#64748b] sm:text-[9px]">
      {formatted}
    </p>
  )
}

function R32KnockoutMatchupBlock({
  label,
  registerRef,
  match,
  r32Bracket,
}: {
  label: string
  registerRef?: RefCallback<HTMLElement>
  match: R32BracketMatchView | undefined
  r32Bracket: R32BracketInteractiveProps
}) {
  const { nowMs, onAdvancePick } = r32Bracket
  const locked =
    match?.lockedAt != null &&
    new Date(match.lockedAt).getTime() <= nowMs
  const myPick = match?.myPick ?? null
  const hasPick = myPick === 1 || myPick === 2
  const homeSelected = myPick === 1
  const awaySelected = myPick === 2
  const canPick = Boolean(match) && !locked

  return (
    <article className="flex w-full min-w-0 flex-col" aria-label={`${label} preview`}>
      <div className="mb-1 flex min-w-0 items-center justify-center gap-1 px-0.5">
        <p className="truncate text-center text-[8px] font-semibold uppercase tracking-wide text-[#64748b] sm:text-[9px] min-[1100px]:text-[10px]">
          {label}
        </p>
        {locked ? (
          <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-[#64748b]">
            Locked
          </span>
        ) : null}
      </div>
      <KnockoutMatchKickoffLine kickoffAt={match?.kickoffAt} />
      <div
        ref={registerRef}
        className="w-full min-w-0 rounded-md border border-[#1e293b]/90 bg-[#0a1018]/60 px-2 py-1.5 shadow-sm"
      >
        <BracketPreviewSideSlot
          name={match?.team1Name}
          selected={homeSelected}
          dimmed={hasPick && !homeSelected}
          onSelect={
            canPick && match && isResolvedR32Team(match.team1Name)
              ? () => onAdvancePick(match.matchId, 1)
              : undefined
          }
        />
        <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
          vs
        </p>
        <BracketPreviewSideSlot
          name={match?.team2Name}
          selected={awaySelected}
          dimmed={hasPick && !awaySelected}
          onSelect={
            canPick && match && isResolvedR32Team(match.team2Name)
              ? () => onAdvancePick(match.matchId, 2)
              : undefined
          }
        />
      </div>
    </article>
  )
}

function R16KnockoutMatchupBlock({
  label,
  registerRef,
  match,
  bracket,
}: {
  label: string
  registerRef?: RefCallback<HTMLElement>
  match: R32BracketMatchView | null
  bracket: KnockoutRoundBracketProps
}) {
  if (!match) {
    return (
      <article
        className="flex w-full min-w-0 flex-col opacity-95"
        aria-label={`${label} to be decided`}
      >
        <div className="mb-1 flex min-w-0 items-center justify-center gap-1 px-0.5">
          <p className="truncate text-center text-[8px] font-semibold uppercase tracking-wide text-[#64748b] sm:text-[9px] min-[1100px]:text-[10px]">
            {label}
          </p>
          <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-[#64748b]">
            Locked
          </span>
        </div>
        <div
          ref={registerRef}
          className="w-full min-w-0 rounded-md border border-[#1e293b]/90 bg-[#0a1018]/40 px-2 py-1.5 shadow-sm"
        >
          <ToBeDecidedSideSlot />
          <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
            vs
          </p>
          <ToBeDecidedSideSlot />
        </div>
      </article>
    )
  }

  return (
    <R32KnockoutMatchupBlock
      label={label}
      registerRef={registerRef}
      match={match}
      r32Bracket={bracket}
    />
  )
}

/** Standard bracket join: horizontal stubs → vertical rail → horizontal into target center. */
function bracketPairConnectorLtr(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  tox: number,
  toy: number,
): string {
  const mergeX = p1x + (tox - p1x) * 0.5
  const midY = (p1y + p2y) / 2
  const entryY = toy
  return [
    `M ${p1x} ${p1y} H ${mergeX}`,
    `M ${p2x} ${p2y} H ${mergeX}`,
    `M ${mergeX} ${Math.min(p1y, p2y)} V ${Math.max(p1y, p2y)}`,
    `M ${mergeX} ${midY} H ${tox}`,
    midY !== entryY ? `M ${tox} ${midY} V ${entryY}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function bracketPairConnectorRtl(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  tox: number,
  toy: number,
): string {
  const mergeX = p1x - (p1x - tox) * 0.5
  const midY = (p1y + p2y) / 2
  const entryY = toy
  return [
    `M ${p1x} ${p1y} H ${mergeX}`,
    `M ${p2x} ${p2y} H ${mergeX}`,
    `M ${mergeX} ${Math.min(p1y, p2y)} V ${Math.max(p1y, p2y)}`,
    `M ${mergeX} ${midY} H ${tox}`,
    midY !== entryY ? `M ${tox} ${midY} V ${entryY}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function SourceRoundColumn({
  half,
  round,
  pairCount,
  width,
  registerMatchupRef,
  r32Bracket,
  sourceBracket,
}: {
  half: BracketHalf
  round: KnockoutPreviewRound
  pairCount: number
  width: string
  registerMatchupRef: (
    half: BracketHalf,
    round: string,
    index: number,
  ) => RefCallback<HTMLElement>
  r32Bracket?: R32BracketInteractiveProps
  sourceBracket?: KnockoutRoundBracketProps
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col self-stretch py-0.5"
      style={{ width }}
    >
      {Array.from({ length: pairCount }, (_, pairIndex) => (
        <div
          key={pairIndex}
          className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-1"
        >
          {Array.from({ length: 2 }, (_, slotInPair) => {
            const index = pairIndex * 2 + slotInPair

            if (round === 'r32' && r32Bracket) {
              const matchNumber = r32MatchNumberForPreviewSlot(half, index)
              const match =
                matchNumber != null
                  ? r32Bracket.matchesByNumber.get(matchNumber)
                  : undefined

              return (
                <R32KnockoutMatchupBlock
                  key={index}
                  label={labelForMatchup(round, half, index)}
                  registerRef={registerMatchupRef(half, round, index)}
                  match={match}
                  r32Bracket={r32Bracket}
                />
              )
            }

            if (
              (round === 'r16' || round === 'qf') &&
              sourceBracket
            ) {
              const match = getKnockoutMatchForVisualSlot(
                round as WinnerKnockoutDisplayRound,
                half,
                index,
                sourceBracket.matchesByNumber,
              )

              return (
                <R16KnockoutMatchupBlock
                  key={index}
                  label={labelForMatchup(round, half, index)}
                  registerRef={registerMatchupRef(half, round, index)}
                  match={match}
                  bracket={sourceBracket}
                />
              )
            }

            if (round === 'r16' && r32Bracket) {
              const { home, away } = getR16ProjectedSides(
                half,
                index,
                r32Bracket.matchesByNumber,
              )

              return (
                <ProjectedR16MatchupBlock
                  key={index}
                  label={labelForMatchup(round, half, index)}
                  registerRef={registerMatchupRef(half, round, index)}
                  homeName={home}
                  awayName={away}
                />
              )
            }

            return (
              <StaticKnockoutMatchupBlock
                key={index}
                label={labelForMatchup(round, half, index)}
                registerRef={registerMatchupRef(half, round, index)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function TargetRoundColumn({
  half,
  round,
  pairCount,
  width,
  registerMatchupRef,
  r32Bracket,
}: {
  half: BracketHalf
  round: KnockoutPreviewRound
  pairCount: number
  width: string
  registerMatchupRef: (
    half: BracketHalf,
    round: string,
    index: number,
  ) => RefCallback<HTMLElement>
  r32Bracket?: R32BracketInteractiveProps
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col self-stretch py-0.5"
      style={{ width }}
    >
      {Array.from({ length: pairCount }, (_, index) => {
        const projected =
          round === 'r16' && r32Bracket
            ? getR16ProjectedSides(half, index, r32Bracket.matchesByNumber)
            : null

        return (
          <div
            key={index}
            className="flex min-h-0 flex-1 items-center py-1"
          >
            {projected ? (
              <ProjectedR16MatchupBlock
                label={labelForMatchup(round, half, index)}
                registerRef={registerMatchupRef(half, round, index)}
                homeName={projected.home}
                awayName={projected.away}
              />
            ) : (
              <StaticKnockoutMatchupBlock
                label={labelForMatchup(round, half, index)}
                registerRef={registerMatchupRef(half, round, index)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function BracketScrollCenter({
  wrapperRef,
  containerRef,
  minWidth,
  children,
}: {
  wrapperRef: RefObject<HTMLDivElement | null>
  containerRef: RefObject<HTMLDivElement | null>
  minWidth: number
  children: React.ReactNode
}) {
  return (
    <div ref={wrapperRef} style={BRACKET_SCROLL_STYLE}>
      <div style={BRACKET_CENTER_STYLE}>
        <div
          ref={containerRef}
          className="relative flex shrink-0 items-stretch px-4 py-6 sm:px-6"
          style={{
            gap: BRACKET_LAYOUT.columnGap,
            minWidth,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function simpleConnectorLtr(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  if (Math.abs(fromY - toY) < 0.5) {
    return `M ${fromX} ${fromY} H ${toX}`
  }
  const midX = fromX + (toX - fromX) * 0.5
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`
}

function simpleConnectorRtl(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  if (Math.abs(fromY - toY) < 0.5) {
    return `M ${fromX} ${fromY} H ${toX}`
  }
  const midX = fromX - (fromX - toX) * 0.5
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`
}

function useBracketConnectors(
  updateConnectors: () => void,
  containerRef: RefObject<HTMLDivElement | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    updateConnectors()

    const container = containerRef.current
    const wrapper = wrapperRef.current
    if (!container) return

    const observer = new ResizeObserver(updateConnectors)
    observer.observe(container)

    wrapper?.addEventListener('scroll', updateConnectors, { passive: true })
    window.addEventListener('resize', updateConnectors)

    return () => {
      observer.disconnect()
      wrapper?.removeEventListener('scroll', updateConnectors)
      window.removeEventListener('resize', updateConnectors)
    }
  }, [updateConnectors, containerRef, wrapperRef])
}

function CenterGap({
  width,
  targetRound,
}: {
  width: string
  targetRound: KnockoutPreviewRound
}) {
  const targetLabel =
    TOURNAMENT_ROUND_LABELS[
      targetRound as keyof typeof TOURNAMENT_ROUND_LABELS
    ] ?? targetRound

  return (
    <div
      className="flex min-w-0 shrink-0 flex-col items-center self-stretch px-1"
      style={{ width }}
      aria-hidden
    >
      <div className="w-px flex-1 bg-[#2a3545]" />
      <div className="my-4 flex flex-col items-center gap-1 px-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22c55e]">
          {targetLabel}
        </p>
        <p className="max-w-[8rem] text-[9px] leading-snug text-[#64748b]">
          Winners advance — full picks on the {targetLabel} tab
        </p>
      </div>
      <div className="w-px flex-1 bg-[#2a3545]" />
    </div>
  )
}

function DesktopTwoSidedKnockoutBracket({
  sourceRound,
  targetRound,
  r32Bracket,
  sourceBracket,
  r16Bracket,
}: KnockoutBracketPreviewProps) {
  const resolvedSourceBracket = sourceBracket ?? r16Bracket
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const matchupRefs = useRef(new Map<string, HTMLElement>())
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([])

  const targetCount = matchupsPerSide(targetRound)
  const pairCount = targetCount

  const registerMatchupRef = useCallback(
    (
      half: BracketHalf,
      round: string,
      index: number,
    ): RefCallback<HTMLElement> =>
      (element) => {
        const key = matchupKey(half, round, index)
        if (element) matchupRefs.current.set(key, element)
        else matchupRefs.current.delete(key)
      },
    [],
  )

  const updateConnectors = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const nextPaths: ConnectorPath[] = []

    for (const half of ['left', 'right'] as const) {
      for (let targetIndex = 0; targetIndex < pairCount; targetIndex++) {
        const parentA = matchupRefs.current.get(
          matchupKey(half, sourceRound, targetIndex * 2),
        )
        const parentB = matchupRefs.current.get(
          matchupKey(half, sourceRound, targetIndex * 2 + 1),
        )
        const child = matchupRefs.current.get(
          matchupKey(half, targetRound, targetIndex),
        )
        if (!parentA || !parentB || !child) continue

        const aRect = parentA.getBoundingClientRect()
        const bRect = parentB.getBoundingClientRect()
        const cRect = child.getBoundingClientRect()

        if (half === 'left') {
          const p1x = aRect.right - containerRect.left
          const p1y = aRect.top + aRect.height / 2 - containerRect.top
          const p2x = bRect.right - containerRect.left
          const p2y = bRect.top + bRect.height / 2 - containerRect.top
          const tox = cRect.left - containerRect.left
          const toy = cRect.top + cRect.height / 2 - containerRect.top
          nextPaths.push({
            id: `${half}-${targetRound}-${targetIndex}`,
            d: bracketPairConnectorLtr(p1x, p1y, p2x, p2y, tox, toy),
          })
        } else {
          const p1x = aRect.left - containerRect.left
          const p1y = aRect.top + aRect.height / 2 - containerRect.top
          const p2x = bRect.left - containerRect.left
          const p2y = bRect.top + bRect.height / 2 - containerRect.top
          const tox = cRect.right - containerRect.left
          const toy = cRect.top + cRect.height / 2 - containerRect.top
          nextPaths.push({
            id: `${half}-${targetRound}-${targetIndex}`,
            d: bracketPairConnectorRtl(p1x, p1y, p2x, p2y, tox, toy),
          })
        }
      }
    }

    setConnectorPaths(nextPaths)
  }, [sourceRound, targetRound, pairCount])

  useBracketConnectors(updateConnectors, containerRef, wrapperRef)

  const columnWidth = BRACKET_LAYOUT.leftR32ColumnWidth

  return (
    <BracketScrollCenter
      wrapperRef={wrapperRef}
      containerRef={containerRef}
      minWidth={BRACKET_INNER_MIN_WIDTH}
    >
      <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          aria-hidden
        >
          {connectorPaths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              stroke={CONNECTOR_COLOR}
              strokeWidth={1}
            />
          ))}
        </svg>

        <SourceRoundColumn
          half="left"
          round={sourceRound}
          pairCount={pairCount}
          width={columnWidth}
          registerMatchupRef={registerMatchupRef}
          r32Bracket={r32Bracket}
          sourceBracket={resolvedSourceBracket}
        />

        <TargetRoundColumn
          half="left"
          round={targetRound}
          pairCount={pairCount}
          width={columnWidth}
          registerMatchupRef={registerMatchupRef}
          r32Bracket={r32Bracket}
        />

        <CenterGap
          width={BRACKET_LAYOUT.centerDividerWidth}
          targetRound={targetRound}
        />

        <TargetRoundColumn
          half="right"
          round={targetRound}
          pairCount={pairCount}
          width={columnWidth}
          registerMatchupRef={registerMatchupRef}
          r32Bracket={r32Bracket}
        />

        <SourceRoundColumn
          half="right"
          round={sourceRound}
          pairCount={pairCount}
          width={BRACKET_LAYOUT.rightR32ColumnWidth}
          registerMatchupRef={registerMatchupRef}
          r32Bracket={r32Bracket}
          sourceBracket={resolvedSourceBracket}
        />
    </BracketScrollCenter>
  )
}

/** Semifinals tab: one matchup per half feeding a center Final preview. */
function KnockoutSemifinalsToFinalPreview({
  sfBracket,
}: {
  sfBracket?: KnockoutRoundBracketProps
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const matchupRefs = useRef(new Map<string, HTMLElement>())
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([])

  const columnWidth = BRACKET_LAYOUT.leftR32ColumnWidth
  const centerWidth = BRACKET_LAYOUT.centerDividerWidth

  const registerMatchupRef = useCallback(
    (key: string): RefCallback<HTMLElement> => (element) => {
      if (element) matchupRefs.current.set(key, element)
      else matchupRefs.current.delete(key)
    },
    [],
  )

  const updateConnectors = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const leftEl = matchupRefs.current.get('left-sf')
    const rightEl = matchupRefs.current.get('right-sf')
    const finalEl = matchupRefs.current.get('final')
    if (!leftEl || !rightEl || !finalEl) return

    const leftRect = leftEl.getBoundingClientRect()
    const rightRect = rightEl.getBoundingClientRect()
    const finalRect = finalEl.getBoundingClientRect()

    const nextPaths: ConnectorPath[] = [
      {
        id: 'left-sf-final',
        d: simpleConnectorLtr(
          leftRect.right - containerRect.left,
          leftRect.top + leftRect.height / 2 - containerRect.top,
          finalRect.left - containerRect.left,
          finalRect.top + finalRect.height / 2 - containerRect.top,
        ),
      },
      {
        id: 'right-sf-final',
        d: simpleConnectorRtl(
          rightRect.left - containerRect.left,
          rightRect.top + rightRect.height / 2 - containerRect.top,
          finalRect.right - containerRect.left,
          finalRect.top + finalRect.height / 2 - containerRect.top,
        ),
      },
    ]

    setConnectorPaths(nextPaths)
  }, [])

  useBracketConnectors(updateConnectors, containerRef, wrapperRef)

  const leftMatch = getKnockoutMatchForVisualSlot(
    'sf',
    'left',
    0,
    sfBracket?.matchesByNumber ?? new Map(),
  )
  const rightMatch = getKnockoutMatchForVisualSlot(
    'sf',
    'right',
    0,
    sfBracket?.matchesByNumber ?? new Map(),
  )

  return (
    <BracketScrollCenter
      wrapperRef={wrapperRef}
      containerRef={containerRef}
      minWidth={520}
    >
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        aria-hidden
      >
        {connectorPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke={CONNECTOR_COLOR}
            strokeWidth={1}
          />
        ))}
      </svg>

      <div
        className="flex min-w-0 flex-1 items-center justify-end self-stretch"
        style={{ width: columnWidth }}
      >
        {sfBracket ? (
          <R16KnockoutMatchupBlock
            label="SF M1"
            registerRef={registerMatchupRef('left-sf')}
            match={leftMatch}
            bracket={sfBracket}
          />
        ) : (
          <StaticKnockoutMatchupBlock
            label="SF M1"
            registerRef={registerMatchupRef('left-sf')}
          />
        )}
      </div>

      <div
        className="flex shrink-0 flex-col items-center justify-center self-stretch px-1"
        style={{ width: centerWidth }}
      >
        <div className="w-px flex-1 bg-[#2a3545]" />
        <div className="my-4 flex w-full flex-col items-center gap-2 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22c55e]">
            {TOURNAMENT_ROUND_LABELS.final}
          </p>
          <div className="w-full min-w-0">
            <StaticKnockoutMatchupBlock
              label="Final"
              registerRef={registerMatchupRef('final')}
            />
          </div>
          <p className="max-w-[8rem] text-center text-[9px] leading-snug text-[#64748b]">
            Winners advance — full picks on the {TOURNAMENT_ROUND_LABELS.final}{' '}
            tab
          </p>
        </div>
        <div className="w-px flex-1 bg-[#2a3545]" />
      </div>

      <div
        className="flex min-w-0 flex-1 items-center justify-start self-stretch"
        style={{ width: columnWidth }}
      >
        {sfBracket ? (
          <R16KnockoutMatchupBlock
            label="SF M2"
            registerRef={registerMatchupRef('right-sf')}
            match={rightMatch}
            bracket={sfBracket}
          />
        ) : (
          <StaticKnockoutMatchupBlock
            label="SF M2"
            registerRef={registerMatchupRef('right-sf')}
          />
        )}
      </div>
    </BracketScrollCenter>
  )
}

const FINAL_ONLY_MIN_WIDTH = 280

/** Final tab: single centered matchup with champion marker. */
function KnockoutFinalOnlyPreview({
  finalBracket,
}: {
  finalBracket?: KnockoutRoundBracketProps
}) {
  const finalMatch = getKnockoutMatchForVisualSlot(
    'final',
    'left',
    0,
    finalBracket?.matchesByNumber ?? new Map(),
  )

  return (
    <div style={BRACKET_SCROLL_STYLE}>
      <div style={BRACKET_CENTER_STYLE}>
        <div
          className="flex flex-col items-center px-4 py-6 sm:px-6"
          style={{ minWidth: FINAL_ONLY_MIN_WIDTH }}
        >
          <div className="w-full min-w-0" style={{ width: BRACKET_LAYOUT.leftR32ColumnWidth }}>
            {finalBracket ? (
              <R16KnockoutMatchupBlock
                label="Final"
                match={finalMatch}
                bracket={finalBracket}
              />
            ) : (
              <StaticKnockoutMatchupBlock label="Final" />
            )}
          </div>
          <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22c55e]">
            World Cup Champion
          </p>
        </div>
      </div>
    </div>
  )
}

/** Preview bracket for any adjacent knockout round pair (e.g. R32→R16, R16→QF). */
export function KnockoutBracketPreview({
  sourceRound,
  targetRound,
  r32Bracket,
  sourceBracket,
  r16Bracket,
}: KnockoutBracketPreviewProps) {
  const sourceCount = matchupsPerSide(sourceRound)
  const targetCount = matchupsPerSide(targetRound)

  if (sourceCount !== targetCount * 2) {
    console.warn(
      `KnockoutBracketPreview: ${sourceRound}→${targetRound} is not a 2:1 side pairing`,
    )
  }

  return (
    <DesktopTwoSidedKnockoutBracket
      sourceRound={sourceRound}
      targetRound={targetRound}
      r32Bracket={r32Bracket}
      sourceBracket={sourceBracket ?? r16Bracket}
      r16Bracket={r16Bracket}
    />
  )
}

/** Round tab → source/target for same-half 2:1 preview brackets. */
export const KNOCKOUT_TAB_PREVIEW = {
  r32: { sourceRound: 'r32', targetRound: 'r16' },
  r16: { sourceRound: 'r16', targetRound: 'qf' },
  qf: { sourceRound: 'qf', targetRound: 'sf' },
} as const satisfies Partial<
  Record<KnockoutPreviewRound, KnockoutTabRoundPair>
>

export type KnockoutBracketTabId = keyof typeof KNOCKOUT_TAB_PREVIEW | 'sf' | 'final'

export function KnockoutBracketForTab({
  tab,
  r32Bracket,
  r16Bracket,
  qfBracket,
  sfBracket,
  finalBracket,
  desktopOnly = false,
  mobileOnly = false,
}: {
  tab: KnockoutBracketTabId
  r32Bracket?: R32BracketInteractiveProps
  r16Bracket?: KnockoutRoundBracketProps
  qfBracket?: KnockoutRoundBracketProps
  sfBracket?: KnockoutRoundBracketProps
  finalBracket?: KnockoutRoundBracketProps
  desktopOnly?: boolean
  mobileOnly?: boolean
}) {
  const roundBracket =
    tab === 'r16'
      ? r16Bracket
      : tab === 'qf'
        ? qfBracket
        : tab === 'sf'
          ? sfBracket
          : tab === 'final'
            ? finalBracket
            : undefined

  let desktop: ReactNode

  if (tab === 'r16' || tab === 'qf') {
    const preview = KNOCKOUT_TAB_PREVIEW[tab]
    desktop = (
      <KnockoutBracketPreview
        sourceRound={preview.sourceRound}
        targetRound={preview.targetRound}
        sourceBracket={roundBracket}
      />
    )
  } else if (tab === 'sf') {
    desktop = <KnockoutSemifinalsToFinalPreview sfBracket={sfBracket} />
  } else if (tab === 'final') {
    desktop = <KnockoutFinalOnlyPreview finalBracket={finalBracket} />
  } else {
    const preview = KNOCKOUT_TAB_PREVIEW[tab]
    desktop = (
      <KnockoutBracketPreview
        sourceRound={preview.sourceRound}
        targetRound={preview.targetRound}
        r32Bracket={r32Bracket}
      />
    )
  }

  const mobile = (
    <div className="w-full min-w-0 max-w-full space-y-3 px-4 md:hidden">
      <KnockoutBracketMobileList
        tab={tab}
        r32Bracket={r32Bracket}
        roundBracket={roundBracket}
      />
    </div>
  )

  if (desktopOnly) {
    return <>{desktop}</>
  }

  if (mobileOnly) {
    return mobile
  }

  return (
    <>
      <div className="hidden md:block">{desktop}</div>
      {mobile}
    </>
  )
}
