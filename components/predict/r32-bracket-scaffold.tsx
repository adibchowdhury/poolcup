'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from 'react'
import { BRACKET_LAYOUT } from '@/src/lib/world-cup-2026-bracket'

const CONNECTOR_COLOR = BRACKET_LAYOUT.connectorColor
const LEFT_R32_COUNT = 8
const SIDE_R16_COUNT = 4

const BRACKET_WRAPPER_STYLE: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  boxSizing: 'border-box',
  overflowX: 'auto',
}

type BracketHalf = 'left' | 'right'
type ConnectorPath = { id: string; d: string }

function matchupKey(half: BracketHalf, round: 'r32' | 'r16', index: number): string {
  return `${half}-${round}-${index}`
}

function leftR32Label(index: number): string {
  return `M${index + 1}`
}

function rightR32Label(index: number): string {
  return `M${index + 9}`
}

function leftR16Label(index: number): string {
  return `R16 M${index + 1}`
}

function rightR16Label(index: number): string {
  return `R16 M${index + 5}`
}

function TbdSlot() {
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

function KnockoutMatchupBlock({
  label,
  registerRef,
}: {
  label: string
  registerRef?: RefCallback<HTMLElement>
}) {
  return (
    <article
      ref={registerRef}
      className="flex w-full min-w-0 flex-col"
      aria-label={`${label} preview`}
    >
      <p className="mb-1 truncate px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[#64748b] sm:text-[9px] min-[1100px]:text-[10px]">
        {label}
      </p>
      <TbdSlot />
      <p className="py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-[#334155]">
        vs
      </p>
      <TbdSlot />
    </article>
  )
}

function bracketPairConnectorLtr(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  tox: number,
  toy: number,
): string {
  const mergeX = p1x + (tox - p1x) * 0.45
  const midY = (p1y + p2y) / 2
  return [
    `M ${p1x} ${p1y} H ${mergeX}`,
    `M ${p2x} ${p2y} H ${mergeX}`,
    `M ${mergeX} ${Math.min(p1y, p2y)} V ${Math.max(p1y, p2y)}`,
    `M ${mergeX} ${midY} H ${tox} V ${toy}`,
  ].join(' ')
}

function bracketPairConnectorRtl(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  tox: number,
  toy: number,
): string {
  const mergeX = p1x - (p1x - tox) * 0.45
  const midY = (p1y + p2y) / 2
  return [
    `M ${p1x} ${p1y} H ${mergeX}`,
    `M ${p2x} ${p2y} H ${mergeX}`,
    `M ${mergeX} ${Math.min(p1y, p2y)} V ${Math.max(p1y, p2y)}`,
    `M ${mergeX} ${midY} H ${tox} V ${toy}`,
  ].join(' ')
}

function MatchupColumn({
  half,
  round,
  count,
  width,
  labelForIndex,
  registerMatchupRef,
}: {
  half: BracketHalf
  round: 'r32' | 'r16'
  count: number
  width: string
  labelForIndex: (index: number) => string
  registerMatchupRef: (
    half: BracketHalf,
    round: 'r32' | 'r16',
    index: number,
  ) => RefCallback<HTMLElement>
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col justify-between self-stretch py-0.5"
      style={{ width }}
    >
      {Array.from({ length: count }, (_, index) => (
        <KnockoutMatchupBlock
          key={index}
          label={labelForIndex(index)}
          registerRef={registerMatchupRef(half, round, index)}
        />
      ))}
    </div>
  )
}

function CenterGap({ width }: { width: string }) {
  return (
    <div
      className="flex min-w-0 shrink-0 flex-col items-center self-stretch px-1"
      style={{ width }}
      aria-hidden
    >
      <div className="w-px flex-1 bg-[#2a3545]" />
      <div className="my-4 flex flex-col items-center gap-1 px-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22c55e]">
          Round of 16
        </p>
        <p className="max-w-[8rem] text-[9px] leading-snug text-[#64748b]">
          Winners advance — picks on the R16 tab
        </p>
      </div>
      <div className="w-px flex-1 bg-[#2a3545]" />
    </div>
  )
}

function DesktopTwoSidedR32Bracket() {
  const containerRef = useRef<HTMLDivElement>(null)
  const matchupRefs = useRef(new Map<string, HTMLElement>())
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([])

  const registerMatchupRef = useCallback(
    (
      half: BracketHalf,
      round: 'r32' | 'r16',
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
      for (let r16Index = 0; r16Index < SIDE_R16_COUNT; r16Index++) {
        const parentA = matchupRefs.current.get(
          matchupKey(half, 'r32', r16Index * 2),
        )
        const parentB = matchupRefs.current.get(
          matchupKey(half, 'r32', r16Index * 2 + 1),
        )
        const child = matchupRefs.current.get(
          matchupKey(half, 'r16', r16Index),
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
            id: `${half}-r16-${r16Index}`,
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
            id: `${half}-r16-${r16Index}`,
            d: bracketPairConnectorRtl(p1x, p1y, p2x, p2y, tox, toy),
          })
        }
      }
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
  }, [updateConnectors])

  const r16ColumnWidth = BRACKET_LAYOUT.leftR32ColumnWidth

  return (
    <div style={BRACKET_WRAPPER_STYLE}>
      <div
        ref={containerRef}
        className="relative mx-auto flex shrink-0 items-stretch px-4 py-6 sm:px-6"
        style={{ gap: BRACKET_LAYOUT.columnGap }}
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

        <MatchupColumn
          half="left"
          round="r32"
          count={LEFT_R32_COUNT}
          width={BRACKET_LAYOUT.leftR32ColumnWidth}
          labelForIndex={leftR32Label}
          registerMatchupRef={registerMatchupRef}
        />

        <MatchupColumn
          half="left"
          round="r16"
          count={SIDE_R16_COUNT}
          width={r16ColumnWidth}
          labelForIndex={leftR16Label}
          registerMatchupRef={registerMatchupRef}
        />

        <CenterGap width={BRACKET_LAYOUT.centerDividerWidth} />

        <MatchupColumn
          half="right"
          round="r16"
          count={SIDE_R16_COUNT}
          width={r16ColumnWidth}
          labelForIndex={rightR16Label}
          registerMatchupRef={registerMatchupRef}
        />

        <MatchupColumn
          half="right"
          round="r32"
          count={LEFT_R32_COUNT}
          width={BRACKET_LAYOUT.rightR32ColumnWidth}
          labelForIndex={rightR32Label}
          registerMatchupRef={registerMatchupRef}
        />
      </div>
    </div>
  )
}

function MobileMatchupCard({ label }: { label: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/90 bg-card/90 p-3 shadow-sm backdrop-blur-sm">
      <KnockoutMatchupBlock label={label} />
    </div>
  )
}

function MobileR32ToR16Stack() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 px-4 pb-4">
      <section className="min-w-0">
        <h3 className="mb-3 font-display text-sm tracking-wide text-primary uppercase">
          Round of 32
        </h3>
        <ul className="flex flex-col gap-2.5">
          {Array.from({ length: 16 }, (_, index) => (
            <li key={index}>
              <MobileMatchupCard label={`M${index + 1}`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="min-w-0 border-t border-border/60 pt-6">
        <h3 className="mb-1 font-display text-sm tracking-wide text-primary uppercase">
          Round of 16
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Where R32 winners advance — full picks on the Round of 16 tab.
        </p>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <div className="min-w-0 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                  R16 M{index + 1}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Winner of M{index * 2 + 1} vs winner of M{index * 2 + 2}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function R32BracketScaffold() {
  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
        This bracket fills in automatically once the group stage ends. Preview
        only — picks are not active yet.
      </p>

      <div className="hidden md:block">
        <DesktopTwoSidedR32Bracket />
      </div>

      <div className="md:hidden">
        <MobileR32ToR16Stack />
      </div>
    </div>
  )
}
