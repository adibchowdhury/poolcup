'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronRight,
  Copy,
  Crown,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type DashboardPoolCardData = {
  id: string
  name: string
  inviteCode: string
  members: number
  yourRank: number | null
  totalPredictions: number
  yourPredictions: number
  nextMatch: string | null
}

interface PoolCardProps {
  pool: DashboardPoolCardData
}

export function PoolCard({ pool }: PoolCardProps) {
  const [copied, setCopied] = useState(false)
  const progressPercent =
    pool.totalPredictions > 0
      ? (pool.yourPredictions / pool.totalPredictions) * 100
      : 0
  const isLeader = pool.yourRank === 1

  const copyCode = () => {
    navigator.clipboard.writeText(pool.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Link href={`/pool/${pool.inviteCode}`}>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card hover-lift"
      >
        <div className="absolute inset-0 animate-shine opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {isLeader && (
          <div className="absolute -right-1 -top-1 z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-[#ffb300] opacity-50 blur-md" />
              <div className="relative flex items-center gap-1 rounded-bl-xl rounded-tr-xl bg-[#ffb300] px-3 py-1 text-[#080b0f]">
                <Crown className="h-4 w-4" />
                <span className="text-sm font-bold">#1</span>
              </div>
            </div>
          </div>
        )}

        <div className="relative p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-2xl tracking-wide text-foreground transition-colors group-hover:text-primary">
                {pool.name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {pool.members} {pool.members === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              active
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/80 p-3 text-center">
              <div className="font-display text-2xl text-foreground">
                {pool.yourRank != null ? `#${pool.yourRank}` : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Your Rank</div>
            </div>
            <div className="rounded-xl bg-muted/80 p-3 text-center">
              <div className="font-display text-2xl text-primary">
                {pool.yourPredictions}
              </div>
              <div className="text-xs text-muted-foreground">Predictions</div>
            </div>
            <div className="rounded-xl bg-muted/80 p-3 text-center">
              <div className="font-mono text-lg text-[#ffb300]">
                {pool.nextMatch ?? '—'}
              </div>
              <div className="text-xs text-muted-foreground">Next Match</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Prediction Progress</span>
              <span className="font-mono text-primary">
                {pool.yourPredictions}/{pool.totalPredictions}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-[#ffb300] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">
                Invite code:
              </span>
              <code className="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">
                {pool.inviteCode}
              </code>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  copyCode()
                }}
                className="shrink-0 rounded p-1 transition-colors hover:bg-muted"
                aria-label="Copy invite code"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1 text-primary transition-transform group-hover:translate-x-1">
              <span className="text-sm font-medium">View Pool</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  )
}
