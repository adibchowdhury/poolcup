'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { handleRovingTabKeyDown } from '@/src/lib/roving-tablist'

export interface StageTab {
  id: string
  label: string
}

interface StageTabsProps {
  tabs: StageTab[]
  activeId: string
  onChange: (id: string) => void
}

export function StageTabs({ tabs, activeId, onChange }: StageTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null)
  const ids = tabs.map((tab) => tab.id)

  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Prediction stage"
        className="flex min-w-max gap-1 rounded-lg border border-border/80 bg-card/50 p-1"
        onKeyDown={(event) =>
          handleRovingTabKeyDown(event, {
            tabs: ids,
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
                'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200 sm:px-4 sm:text-sm',
                FOCUS_VISIBLE_RING,
                active
                  ? 'bg-primary text-primary-foreground shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_25%,transparent)]'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
