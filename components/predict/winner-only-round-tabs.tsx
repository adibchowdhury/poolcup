'use client'

import { cn } from '@/lib/utils'
import { TOURNAMENT_ROUND_LABELS } from '@/src/lib/tournament-round-labels'

export type WinnerOnlyRoundTabId =
  | 'bracket'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'

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
        <div className="flex w-max min-w-full md:w-full" role="tablist">
          {tabs.map((tab) => {
            const active = tab.id === activeId
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(tab.id)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors md:flex-1 md:shrink md:px-4',
                  active
                    ? 'text-[#f0f4f8]'
                    : 'text-[#5a7080] hover:text-[#f0f4f8]/80',
                )}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#00e676]" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
