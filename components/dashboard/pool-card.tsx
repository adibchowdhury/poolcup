'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useClientNow } from '@/hooks/use-client-now'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Trophy,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { emitPoolMarkedRead } from '@/src/lib/pool-unread-counts'
import { trackEvent } from '@/src/lib/track'

export type PoolMemberAvatar = {
  displayName: string
  initials: string
}

export type ScoringStyleId = 'winner' | 'classic' | 'exact' // exact: legacy DB pools only

export type DashboardPoolCardData = {
  id: string
  name: string
  eventName: string
  scoringStyle: ScoringStyleId | string
  inviteCode: string
  members: number
  memberAvatars: PoolMemberAvatar[]
  yourRank: number | null
  totalPredictions: number
  yourPredictions: number
  nextMatchKickoffAt: string | null
  predictionsLocked: boolean
  canDelete?: boolean
}

function formatCountdown(ms: number): { label: string; isLive: boolean } {
  if (ms <= 0) {
    return { label: 'LIVE NOW', isLive: true }
  }

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    label: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    isLive: false,
  }
}

const PROGRESS_GREEN = '#22c55e'
const PROGRESS_YELLOW = '#f59e0b'
const PROGRESS_RED = '#ef4444'

function getProgressBarColor(predictions: number, total: number): string {
  if (total <= 0) return PROGRESS_RED
  const greenMin = Math.floor(total * 0.67)
  const yellowMin = Math.ceil(total * 0.34)
  if (predictions >= greenMin) return PROGRESS_GREEN
  if (predictions >= yellowMin) return PROGRESS_YELLOW
  return PROGRESS_RED
}

const MAX_VISIBLE_MEMBER_AVATARS = 4

function UnreadChatBadge({
  inviteCode,
  poolId,
  unreadCount,
}: {
  inviteCode: string
  poolId: string
  unreadCount: number
}) {
  if (unreadCount <= 0) return null

  return (
    <Link
      href={`/pool/${inviteCode}?tab=chat`}
      onClick={(event) => {
        event.stopPropagation()
        emitPoolMarkedRead(poolId)
      }}
      aria-label={`${unreadCount} unread messages, open chat`}
      className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center text-sm text-muted-foreground"
    >
      💬 {unreadCount}
    </Link>
  )
}

function PoolMemberAvatars({
  members,
  memberAvatars,
  inviteCode,
  poolId,
  unreadCount = 0,
}: {
  members: number
  memberAvatars: PoolMemberAvatar[]
  inviteCode: string
  poolId: string
  unreadCount?: number
}) {
  const visible = memberAvatars.slice(0, MAX_VISIBLE_MEMBER_AVATARS)
  const overflow = Math.max(0, members - MAX_VISIBLE_MEMBER_AVATARS)

  if (members === 1 && visible[0]) {
    return (
      <div className="mt-2 flex items-center gap-2.5">
        <MemberAvatarCircle
          initials={visible[0].initials}
          displayName={visible[0].displayName}
          accent
        />
        <span className="text-sm text-muted-foreground">Invite friends</span>
        <UnreadChatBadge
          inviteCode={inviteCode}
          poolId={poolId}
          unreadCount={unreadCount}
        />
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2.5">
      <div className="flex items-center">
        {visible.map((member, index) => (
          <MemberAvatarCircle
            key={`${member.displayName}-${index}`}
            initials={member.initials}
            displayName={member.displayName}
            className={index > 0 ? '-ml-2' : undefined}
            accent={index === 0}
          />
        ))}
        {overflow > 0 && (
          <div
            className="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card bg-[#1a2535] text-xs font-semibold text-primary ring-2 ring-card"
            aria-label={`${overflow} more members`}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        {members} {members === 1 ? 'member' : 'members'}
      </span>
      <UnreadChatBadge
        inviteCode={inviteCode}
        poolId={poolId}
        unreadCount={unreadCount}
      />
    </div>
  )
}

function MemberAvatarCircle({
  initials,
  displayName,
  className,
  accent = false,
}: {
  initials: string
  displayName: string
  className?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card bg-[#1a2535] text-xs font-semibold ring-2 ring-card',
        accent ? 'text-primary' : 'text-white',
        className,
      )}
      title={displayName}
      aria-label={displayName}
    >
      {initials}
    </div>
  )
}

function NextMatchCountdown({
  kickoffAt,
  mounted,
  nowMs,
}: {
  kickoffAt: string | null
  mounted: boolean
  nowMs: number
}) {
  if (!kickoffAt) {
    return <div className="font-mono text-lg text-[#ffb300]">—</div>
  }

  if (!mounted) {
    return (
      <div
        className="font-mono text-sm leading-tight text-[#ffb300] tabular-nums sm:text-lg"
        aria-hidden
      >
        —
      </div>
    )
  }

  const { label, isLive } = formatCountdown(
    new Date(kickoffAt).getTime() - nowMs,
  )

  return (
    <div
      className={cn(
        'font-mono text-sm leading-tight sm:text-lg',
        isLive ? 'animate-pulse font-semibold text-primary' : 'text-[#ffb300]',
      )}
      suppressHydrationWarning
    >
      {label}
    </div>
  )
}

interface PoolCardProps {
  pool: DashboardPoolCardData
  unreadCount?: number
  onPoolDeleted?: (poolId: string) => void
}

export function PoolCard({ pool, unreadCount = 0, onPoolDeleted }: PoolCardProps) {
  const [copied, setCopied] = useState(false)
  const { mounted, nowMs } = useClientNow(1000)
  const totalMatches = pool.totalPredictions > 0 ? pool.totalPredictions : 72
  const progressPercent =
    totalMatches > 0 ? (pool.yourPredictions / totalMatches) * 100 : 0
  const progressBarColor = getProgressBarColor(pool.yourPredictions, totalMatches)
  const showKickoffWarning = progressPercent < 50
  const isZeroProgress = pool.yourPredictions === 0
  const isLeader = pool.yourRank === 1
  const predictionsComplete =
    totalMatches > 0 && pool.yourPredictions >= totalMatches
  const nextKickoffMs = pool.nextMatchKickoffAt
    ? new Date(pool.nextMatchKickoffAt).getTime()
    : null
  const showPredictButton =
    mounted &&
    !pool.predictionsLocked &&
    nextKickoffMs != null &&
    nextKickoffMs > nowMs
  const predictButtonHref =
    pool.scoringStyle === 'winner'
      ? `/pool/${pool.inviteCode}/predict`
      : `/pool/${pool.inviteCode}`

  const copyCode = () => {
    const joinUrl = `${window.location.origin}/join/${pool.inviteCode}`
    navigator.clipboard.writeText(joinUrl)
    trackEvent('invite_link_copied', {
      poolId: pool.id,
      metadata: { source: 'dashboard_card' },
    })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card hover-lift">
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
              <Link href={`/pool/${pool.inviteCode}`}>
                <h3 className="font-display text-2xl tracking-wide text-foreground transition-colors group-hover:text-primary">
                  {pool.name}
                </h3>
              </Link>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy
                  className="h-3 w-3 shrink-0 text-muted-foreground/80"
                  aria-hidden
                />
                <span className="truncate">{pool.eventName}</span>
              </p>
              <PoolMemberAvatars
                members={pool.members}
                memberAvatars={pool.memberAvatars}
                inviteCode={pool.inviteCode}
                poolId={pool.id}
                unreadCount={unreadCount}
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <span className="rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                {formatScoringStyleLabel(pool.scoringStyle)}
              </span>
              {pool.canDelete && (
                <DeletePoolDialog
                  poolId={pool.id}
                  poolName={pool.name}
                  redirectTo="/dashboard"
                  onDeleted={() => onPoolDeleted?.(pool.id)}
                  iconOnly
                />
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/80 p-4 text-center">
              <div className="font-display text-2xl text-primary sm:text-3xl">
                {pool.yourPredictions}
              </div>
              <div className="text-xs text-muted-foreground sm:text-sm">
                Predictions
              </div>
            </div>
            <div className="rounded-xl bg-muted/80 p-4 text-center">
              <NextMatchCountdown
                kickoffAt={pool.nextMatchKickoffAt}
                mounted={mounted}
                nowMs={nowMs}
              />
              <div className="text-xs text-muted-foreground sm:text-sm">
                Next Match
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Prediction Progress</span>
              <span className="font-mono text-primary">
                {pool.yourPredictions}/{totalMatches}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  backgroundColor: progressBarColor,
                }}
              />
            </div>
            {predictionsComplete && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#22c55e]">
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                All predictions submitted!
              </p>
            )}
            {!predictionsComplete && showKickoffWarning && isZeroProgress && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#ef4444]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Predictions lock at kickoff — don&apos;t get caught out!
              </p>
            )}
            {!predictionsComplete && showKickoffWarning && !isZeroProgress && (
              <p className="mt-2 text-xs text-muted-foreground">
                Predictions lock at kickoff — don&apos;t get caught out!
              </p>
            )}
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
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {showPredictButton && (
                <Button
                  asChild
                  size="sm"
                  className="gap-1.5 bg-primary px-4 font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
                >
                  <Link href={predictButtonHref}>
                    <Zap className="h-4 w-4 fill-current" aria-hidden />
                    {predictionsComplete
                      ? 'Update Predictions'
                      : 'Predict Now'}
                  </Link>
                </Button>
              )}
              <Link
                href={`/pool/${pool.inviteCode}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                View Pool
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}
