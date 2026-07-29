'use client'

import Link from 'next/link'
import {
  MessageCircle,
  Swords,
  Target,
  Trophy,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/**
 * TODO(mock): Replace with real due-predictions / live / unread / battles queries.
 */
const MOCK_CONTINUE_PLAYING = {
  predictionsDue: 3,
  livePools: [
    { poolName: 'Office World Cup', matchLabel: 'Brazil vs France · Live' },
    { poolName: 'MLS Official', matchLabel: 'LAFC vs Inter Miami · HT' },
  ],
  unreadChats: 2,
  closeBattles: [
    { poolName: 'Premier League Official', pointsDiff: 4 },
    { poolName: 'Friday Night Pool', pointsDiff: 1 },
  ],
} as const

function ContinueChip({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Target
  label: string
  value: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="min-w-0 rounded-xl border border-border/70 bg-background/40 px-3 py-3.5 text-center shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset] transition-colors hover:border-primary/40 hover:bg-primary/5 sm:py-4"
    >
      <Icon className="mx-auto h-5 w-5 text-primary" aria-hidden />
      <p className="mt-2 font-display text-2xl leading-none tracking-wide tabular-nums text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </Link>
  )
}

/** Action strip above Discover — intentionally overlaps Live Now conceptually. */
export function ContinuePlayingSection() {
  const mock = MOCK_CONTINUE_PLAYING
  const liveCount = mock.livePools.length
  const battleHint =
    mock.closeBattles[0] != null
      ? `${mock.closeBattles[0].pointsDiff} pts`
      : '—'

  return (
    <DashboardFeedSection id="continue-playing" title="Continue Playing">
      <DashboardPlainCard>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ContinueChip
            icon={Target}
            label="Predictions due"
            value={String(mock.predictionsDue)}
            href={DASHBOARD_TAB_HREFS.upcoming}
          />
          <ContinueChip
            icon={Swords}
            label="Live pools"
            value={String(liveCount)}
            href={DASHBOARD_TAB_HREFS.pools}
          />
          <ContinueChip
            icon={MessageCircle}
            label="Unread chats"
            value={String(mock.unreadChats)}
            href="/chat"
          />
          <ContinueChip
            icon={Trophy}
            label="Close battles"
            value={battleHint}
            href={DASHBOARD_TAB_HREFS.pools}
          />
        </div>
        {mock.livePools.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
            {mock.livePools.map((pool) => (
              <li
                key={pool.poolName}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate font-medium text-foreground">
                  {pool.poolName}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {pool.matchLabel}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
