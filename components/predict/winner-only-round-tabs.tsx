'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { handleRovingTabKeyDown } from '@/src/lib/roving-tablist'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'

export type WinnerOnlyRoundTabId =
  | 'bracket'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'

const WINNER_ONLY_ROUND_TAB_ORDER = [
  'bracket',
  'r32',
  'r16',
  'qf',
  'sf',
  'final',
] as const satisfies readonly WinnerOnlyRoundTabId[]

export function isWinnerOnlyLockedRoundTab(tab: WinnerOnlyRoundTabId): boolean {
  return tab !== 'bracket'
}

interface WinnerOnlyRoundTabsProps {
  activeId: WinnerOnlyRoundTabId
  onChange: (id: WinnerOnlyRoundTabId) => void
}

export function WinnerOnlyRoundTabs({
  activeId,
  onChange,
}: WinnerOnlyRoundTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null)
  const tabs: { id: WinnerOnlyRoundTabId; label: string }[] = [
    { id: 'bracket', label: TOURNAMENT_ROUND_LABELS.group },
    { id: 'r32', label: TOURNAMENT_ROUND_LABELS.r32 },
    { id: 'r16', label: TOURNAMENT_ROUND_LABELS.r16 },
    { id: 'qf', label: TOURNAMENT_ROUND_LABELS.qf },
    { id: 'sf', label: TOURNAMENT_ROUND_LABELS.sf },
    { id: 'final', label: TOURNAMENT_ROUND_LABELS.final },
  ]

  return (
    <div className="min-w-0 border-b border-[rgba(255,255,255,0.08)]">
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 md:mx-0 md:overflow-x-visible md:px-0">
        <div
          ref={tablistRef}
          className="flex w-max min-w-full md:w-full"
          role="tablist"
          aria-label="Tournament round"
          onKeyDown={(event) =>
            handleRovingTabKeyDown(event, {
              tabs: WINNER_ONLY_ROUND_TAB_ORDER,
              activeId,
              onChange,
              tablist: tablistRef.current,
            })
          }
        >
          {tabs.map((tab) => {
            const active = tab.id === activeId
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-tab-id={tab.id}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(tab.id)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-sm px-3 py-3 text-sm font-semibold transition-colors md:flex-1 md:shrink md:px-4',
                  FOCUS_VISIBLE_RING,
                  active
                    ? 'text-[#f0f4f8]'
                    : 'text-[#5a7080] hover:text-[#f0f4f8]/80',
                )}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
