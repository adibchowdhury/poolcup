'use client'

import Link from 'next/link'
import { Flame, MessageSquare, Users } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/**
 * TODO(mock): Wire growth / prediction volume / chat heat from analytics.
 */
const MOCK_TRENDING = [
  {
    id: 'growth',
    icon: Users,
    title: 'Fastest-growing pool',
    detail: 'MLS Official · +48 players this week',
    href: '#official-pools',
  },
  {
    id: 'predicted',
    icon: Flame,
    title: 'Most-predicted match',
    detail: 'Real Madrid vs Bayern · 1.2k predictions',
    href: DASHBOARD_TAB_HREFS.upcoming,
  },
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'Hottest discussion',
    detail: 'Office World Cup chat · 86 messages today',
    href: '/chat',
  },
] as const

export function TrendingSection() {
  return (
    <DashboardFeedSection id="trending" title="Trending">
      <DashboardPlainCard>
        <ul className="grid gap-2 sm:grid-cols-3">
          {MOCK_TRENDING.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-3 shadow-[0_0_0_1px_rgba(0,230,118,0.05)_inset] transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
