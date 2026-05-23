'use client'

import { cn } from '@/lib/utils'

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
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-lg border border-border/80 bg-card/50 p-1">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200 sm:px-4 sm:text-sm',
                active
                  ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(0,230,118,0.25)]'
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
