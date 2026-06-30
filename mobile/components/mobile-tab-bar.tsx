'use client'

import {
  Calendar,
  MessageCircle,
  Trophy,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type MobileTabId = 'matches' | 'pools' | 'chat' | 'profile'

const TAB_ITEMS: {
  id: MobileTabId
  label: string
  icon: typeof User
}[] = [
  { id: 'matches', label: 'Matches', icon: Calendar },
  { id: 'pools', label: 'Pools', icon: Trophy },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: User },
]

type MobileTabBarProps = {
  activeTab: MobileTabId
  onTabChange: (tabId: MobileTabId) => void
}

function tabItemClassName(isActive: boolean) {
  return cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-px overflow-visible px-0.5 py-0.5 text-[10px] font-medium transition-colors',
    isActive
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground',
  )
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-border/80 bg-background/95 pt-1.5 pb-[calc(0.5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] backdrop-blur-md"
      aria-label="Main navigation"
    >
      <div className="flex h-12 w-full items-stretch overflow-visible px-2">
        {TAB_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={tabItemClassName(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Scroll padding so content clears the fixed tab bar + bottom safe area. */
export const MOBILE_TAB_BAR_SCROLL_PAD_CLASS =
  'pb-[calc(3.875rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]'
