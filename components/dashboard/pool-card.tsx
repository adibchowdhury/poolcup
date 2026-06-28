'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useClientNow } from '@/hooks/use-client-now'
import {
  ArrowRight,
  Check,
  Copy,
  MoreVertical,
  Target,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import {
  getPoolLeaderboardHref,
} from '@/src/lib/pool-unread-counts'
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

const MAX_VISIBLE_MEMBER_AVATARS = 4

type PoolTypePillTheme = {
  accent: string
  accentBg: string
  accentBorder: string
}

function getPoolTypePillTheme(scoringStyle: string): PoolTypePillTheme {
  if (scoringStyle === 'winner') {
    return {
      accent: '#f59e0b',
      accentBg: 'rgba(245,158,11,0.10)',
      accentBorder: 'rgba(245,158,11,0.35)',
    }
  }

  return {
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.10)',
    accentBorder: 'rgba(34,197,94,0.35)',
  }
}

const RANK_MEDAL_CHIP: Record<
  1 | 2 | 3,
  { emoji: string; backgroundColor: string; color: string }
> = {
  1: { emoji: '🥇', backgroundColor: '#e3b341', color: '#3a2a00' },
  2: { emoji: '🥈', backgroundColor: '#b9bfc9', color: '#20242b' },
  3: { emoji: '🥉', backgroundColor: '#c47a3d', color: '#301606' },
}

function RankMedalChip({ place }: { place: number | null }) {
  if (place == null || place > 3) return null

  const medal = RANK_MEDAL_CHIP[place as 1 | 2 | 3]
  if (!medal) return null

  return (
    <div className="mt-1">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-xs font-medium whitespace-nowrap"
        style={{
          backgroundColor: medal.backgroundColor,
          color: medal.color,
        }}
      >
        <span aria-hidden>{medal.emoji}</span>
        Currently in {ordinalPlace(place)} place
      </span>
    </div>
  )
}

interface PoolCardProps {
  pool: DashboardPoolCardData
  onPoolDeleted?: (poolId: string) => void
}

export function PoolCard({ pool, onPoolDeleted }: PoolCardProps) {
  const [copied, setCopied] = useState(false)
  const deleteTriggerRef = useRef<HTMLDivElement>(null)
  const { mounted, nowMs } = useClientNow(1000)
  const TypeIcon = pool.scoringStyle === 'winner' ? Trophy : Target
  const typeLabel = formatScoringStyleLabel(pool.scoringStyle)
  const typePillTheme = getPoolTypePillTheme(pool.scoringStyle)
  const totalMatches = pool.totalPredictions > 0 ? pool.totalPredictions : 72
  const progressPercent =
    totalMatches > 0 ? (pool.yourPredictions / totalMatches) * 100 : 0
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
      ? `/pool/${pool.inviteCode}?tab=predictions`
      : `/pool/${pool.inviteCode}`
  const visibleAvatars = pool.memberAvatars.slice(0, MAX_VISIBLE_MEMBER_AVATARS)
  const overflowCount = Math.max(0, pool.members - MAX_VISIBLE_MEMBER_AVATARS)
  const playersLabel = `${pool.members} ${pool.members === 1 ? 'player' : 'players'}`

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

  const openDeleteDialog = () => {
    deleteTriggerRef.current?.querySelector('button')?.click()
  }

  return (
    <div className="dashboard-pool-card rounded-2xl">
      <div className="overflow-hidden rounded-2xl border border-border/90 bg-card/90">
      <div className="border-b border-border px-[15px] py-[13px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex flex-col gap-1">
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                color: typePillTheme.accent,
                backgroundColor: typePillTheme.accentBg,
                borderColor: typePillTheme.accentBorder,
              }}
            >
              <TypeIcon
                className="h-3 w-3 shrink-0"
                style={{ color: typePillTheme.accent }}
                aria-hidden
              />
              {typeLabel}
            </span>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy
                className="h-3 w-3 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
              <span className="truncate">{pool.eventName}</span>
            </p>
          </div>

          {pool.canDelete ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Pool options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      openDeleteDialog()
                    }}
                  >
                    Delete pool
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div ref={deleteTriggerRef} className="sr-only" aria-hidden>
                <DeletePoolDialog
                  poolId={pool.id}
                  poolName={pool.name}
                  redirectTo="/dashboard"
                  onDeleted={() => onPoolDeleted?.(pool.id)}
                  iconOnly
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-[15px] pt-[14px]">
        <Link href={`/pool/${pool.inviteCode}`} className="block">
          <h3 className="font-display text-2xl tracking-wide text-foreground transition-colors hover:text-primary">
            {pool.name}
          </h3>
        </Link>

        <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {visibleAvatars.map((member, index) => (
                <div
                  key={`${member.displayName}-${index}`}
                  className={cn(
                    'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-card bg-[#1a2535] text-[10px] font-semibold ring-2 ring-card',
                    index === 0 ? 'text-primary' : 'text-white',
                    index > 0 && '-ml-[7px]',
                  )}
                  title={member.displayName}
                  aria-label={member.displayName}
                >
                  {member.initials}
                </div>
              ))}
              {overflowCount > 0 ? (
                <div
                  className="-ml-[7px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-card bg-[#1a2535] text-[10px] font-semibold text-primary ring-2 ring-card"
                  aria-label={`${overflowCount} more players`}
                >
                  +{overflowCount}
                </div>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground">{playersLabel}</span>
          </div>
          <RankMedalChip place={pool.yourRank} />
        </div>

        <div className="mt-3.5 pb-[14px]">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Your predictions</span>
            <span className="font-mono text-primary">
              {pool.yourPredictions} / {totalMatches}
            </span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-[15px] pb-[14px]">
        <div className="flex flex-nowrap gap-2">
          {showPredictButton ? (
            <Link
              href={predictButtonHref}
              className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-primary px-2.5 py-[11px] text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3"
            >
              <Zap className="h-4 w-4 shrink-0 fill-current" aria-hidden />
              <span className="truncate">
                {predictionsComplete ? 'Update Predictions' : 'Predict Now'}
              </span>
            </Link>
          ) : null}
          <Link
            href={getPoolLeaderboardHref(pool.inviteCode)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border bg-transparent px-2.5 py-[11px] text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3',
              showPredictButton ? undefined : 'w-full',
            )}
          >
            View Leaderboard
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>

        <button
          type="button"
          onClick={copyCode}
          className="mt-2 flex w-full items-center gap-2 rounded-[10px] border border-border bg-transparent px-3 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <UserPlus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-medium text-primary">
            Invite friends
          </span>
          <code className="font-mono text-sm text-foreground">{pool.inviteCode}</code>
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
            aria-hidden
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 hover:text-foreground" />
            )}
          </span>
        </button>
      </div>
      </div>
    </div>
  )
}
