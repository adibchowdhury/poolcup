'use client'

import Link from 'next/link'
import { TrendingUp, UserPlus, Target } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/**
 * TODO(mock): Wire friend social events from follows / pool memberships.
 */
const MOCK_FRIENDS_ACTIVITY = [
  {
    id: 'pass',
    icon: TrendingUp,
    text: 'Jordan passed you in Office World Cup',
    href: DASHBOARD_TAB_HREFS.pools,
  },
  {
    id: 'join',
    icon: UserPlus,
    text: 'Sam joined Premier League Official',
    href: '#official-pools',
  },
  {
    id: 'exact',
    icon: Target,
    text: 'Alex got an exact score on Arsenal vs Liverpool',
    href: DASHBOARD_TAB_HREFS.upcoming,
  },
] as const

export function FriendsActivitySection() {
  return (
    <DashboardFeedSection id="friends-activity" title="Friends Activity">
      <DashboardPlainCard>
        <ul className="space-y-2.5">
          {MOCK_FRIENDS_ACTIVITY.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-3 shadow-[0_0_0_1px_rgba(0,230,118,0.05)_inset] transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{item.text}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
