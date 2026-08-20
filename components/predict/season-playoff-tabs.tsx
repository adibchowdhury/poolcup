'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { handleRovingTabKeyDown } from '@/src/lib/roving-tablist'

export const SEASON_PLAYOFF_PHASE_ORDER = ['season', 'playoffs'] as const

export type SeasonPlayoffPhaseId = (typeof SEASON_PLAYOFF_PHASE_ORDER)[number]

const PHASE_LABELS: Record<SeasonPlayoffPhaseId, string> = {
  season: 'Season',
  playoffs: 'Playoffs',
}

interface SeasonPlayoffTabsProps {
  activeId: SeasonPlayoffPhaseId
  onChange: (id: SeasonPlayoffPhaseId) => void
}

export function SeasonPlayoffTabs({ activeId, onChange }: SeasonPlayoffTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-w-0 border-b border-[rgba(255,255,255,0.08)]">
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 md:mx-0 md:overflow-x-visible md:px-0">
        <div
          ref={tablistRef}
          className="flex w-max min-w-full md:w-full"
          role="tablist"
          aria-label="Season or playoffs"
          onKeyDown={(event) =>
            handleRovingTabKeyDown(event, {
              tabs: SEASON_PLAYOFF_PHASE_ORDER,
              activeId,
              onChange,
              tablist: tablistRef.current,
            })
          }
        >
          {SEASON_PLAYOFF_PHASE_ORDER.map((id) => {
            const active = id === activeId
            return (
              <button
                key={id}
                type="button"
                role="tab"
                data-tab-id={id}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(id)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-sm px-3 py-3 text-sm font-semibold transition-colors md:flex-1 md:shrink md:px-4',
                  FOCUS_VISIBLE_RING,
                  active
                    ? 'text-[#f0f4f8]'
                    : 'text-[#5a7080] hover:text-[#f0f4f8]/80',
                )}
              >
                {PHASE_LABELS[id]}
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
