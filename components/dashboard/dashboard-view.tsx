'use client'

import Link from 'next/link'
import {
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSignOut } from '@/components/dashboard-sign-out'
import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { cn } from '@/lib/utils'

export type DashboardQuickStats = {
  totalPoints: number
  predictionsMade: number
  winRate: number | null
}

interface DashboardViewProps {
  email: string
  pools: DashboardPoolCardData[]
  quickStats: DashboardQuickStats
  passwordResetSuccess?: boolean
  errorMessage?: string | null
}

export function DashboardView({
  email,
  pools,
  quickStats,
  passwordResetSuccess,
  errorMessage,
}: DashboardViewProps) {
  const quickStatItems = [
    {
      label: 'Total Points',
      value: quickStats.totalPoints.toLocaleString(),
      icon: Zap,
      color: 'text-primary',
    },
    {
      label: 'Predictions Made',
      value: quickStats.predictionsMade.toLocaleString(),
      icon: Target,
      color: 'text-[#ffb300]',
    },
    {
      label: 'Win Rate',
      value:
        quickStats.winRate != null ? `${quickStats.winRate}%` : '—',
      icon: TrendingUp,
      color: 'text-primary',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary opacity-50 blur-lg" />
                  <div className="relative rounded-xl bg-primary p-2 text-primary-foreground">
                    <Trophy className="h-6 w-6" />
                  </div>
                </div>
                <h1 className="font-display text-4xl tracking-wide text-foreground">
                  MY POOLS
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DashboardSignOut email={email} />
                <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 group">
                  <Link href="/create">
                    <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                    Create a Pool
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          {passwordResetSuccess && (
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              Your password has been updated successfully.
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {quickStatItems.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  'flex cursor-default items-center gap-4 rounded-2xl border border-border bg-card p-4 hover-lift',
                  i === 0 && 'animate-float',
                  i === 1 && 'animate-float-delayed',
                  i === 2 && 'animate-float-delayed-2',
                )}
              >
                <div className={cn('rounded-xl bg-muted p-3', stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-display text-3xl text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[#ffb300]" />
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              Your Active Pools
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {pools.map((pool, index) => (
              <PoolCard key={pool.id} pool={pool} index={index} />
            ))}

            <Link
              href="/create"
              className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-[#ffb300]/5 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted transition-transform group-hover:scale-110">
                  <Plus className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <h3 className="mb-2 font-display text-xl text-foreground">
                  Join or Create a Pool
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Start competing with friends or join an existing pool with an
                  invite code
                </p>
              </div>
            </Link>
          </div>

          {pools.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No pools yet — create one or join with an invite link from a friend.
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
