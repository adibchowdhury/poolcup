'use client'

import Link from 'next/link'
import { ArrowRight, Gift, Sparkles, UserPlus, Zap } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { Button } from '@/components/ui/button'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/**
 * TODO(mock): Wire featured match from fetchFeaturedMatch / event matches.
 */
const MOCK_DAILY_CHALLENGE = {
  prompts: [
    {
      id: 'predict',
      title: 'Predict today’s featured match',
      detail: 'Arsenal vs Liverpool · Kickoff 3:00 PM',
      href: DASHBOARD_TAB_HREFS.upcoming,
      icon: Zap,
    },
    {
      id: 'join',
      title: 'Join a pool',
      detail: 'Hop into an Official league pool',
      href: '#official-pools',
      icon: Gift,
    },
    {
      id: 'invite',
      title: 'Invite a friend',
      detail: 'Grow your squad and earn points',
      href: '/create',
      icon: UserPlus,
    },
  ],
} as const

/** Compact rotating-style CTA strip (shows stacked prompts). */
export function DailyChallengeSection() {
  return (
    <DashboardFeedSection id="daily-challenge" title="Daily Challenge">
      <DashboardPlainCard className="space-y-2.5">
        {MOCK_DAILY_CHALLENGE.prompts.map((prompt) => {
          const Icon = prompt.icon
          return (
            <div
              key={prompt.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {prompt.title}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {prompt.detail}
                </p>
              </div>
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link href={prompt.href}>
                  Go
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          )
        })}
        <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-[#ffb300]" aria-hidden />
          Earn points for completing today’s challenges
        </p>
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
