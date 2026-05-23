'use client'

import { cn } from '@/lib/utils'

export type GroupKnockoutTabId = 'group' | 'knockout'

interface GroupKnockoutTabsProps {
  activeId: GroupKnockoutTabId
  onChange: (id: GroupKnockoutTabId) => void
}

export function GroupKnockoutTabs({ activeId, onChange }: GroupKnockoutTabsProps) {
  const tabs: { id: GroupKnockoutTabId; label: string }[] = [
    { id: 'group', label: 'Group Stage' },
    { id: 'knockout', label: 'Knockouts' },
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
