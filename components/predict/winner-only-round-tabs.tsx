'use client'

import { cn } from '@/lib/utils'

export type WinnerOnlyRoundTabId = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

export const WINNER_ONLY_LOCKED_ROUND_MESSAGE =
  'These matches will be available once the previous round is complete.'

export function isWinnerOnlyLockedRoundTab(tab: WinnerOnlyRoundTabId): boolean {
  return tab !== 'r32'
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
    { id: 'r32', label: 'Round of 32' },
    { id: 'r16', label: 'Round of 16' },
    { id: 'qf', label: 'Quarterfinals' },
    { id: 'sf', label: 'Semifinals' },
    { id: 'final', label: 'Final' },
  ]

  return (
    <div className="border-b border-[rgba(255,255,255,0.08)]">
      <div className="flex">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex-1 px-4 py-3 text-sm font-semibold transition-colors',
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
  )
}
