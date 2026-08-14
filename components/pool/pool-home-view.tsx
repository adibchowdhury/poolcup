'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Check,
  Copy,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type LeaderboardMember } from '@/components/pool/leaderboard-row'
import { LeaderboardSkeleton } from '@/components/pool/leaderboard-skeleton'
import { LiveScoreboard } from '@/components/dashboard/live-scoreboard'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { ReportPoolControl } from '@/components/pool/report-pool-control'
import { PoolAnnouncementBanner } from '@/components/pool/pool-announcement-banner'
import { PoolInviteCard } from '@/components/pool/pool-invite-card'
import { SoloInviteNudge } from '@/components/pool/solo-invite-nudge'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { PoolPredictionsTab } from '@/components/pool/pool-predictions-tab'
import { PoolSettingsTab } from '@/components/pool/pool-settings-tab'
import { PoolLeaderboardStandings } from '@/components/pool/pool-leaderboard-standings'
import {
  USE_MOCK_LEADERBOARD,
  buildMockLeaderboardMembers,
} from '@/components/pool/mock-leaderboard-preview'
import {
  PoolChatTab,
  type PoolChatMemberProfile,
} from '@/components/pool/pool-chat-tab'
import { cn } from '@/lib/utils'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
  MOBILE_BOTTOM_NAV_PAD_CLASS,
} from '@/src/lib/mobile-bottom-nav-routes'
import { trackEvent } from '@/src/lib/track'
import { capturePostHog } from '@/src/lib/posthog-client'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import type { MemberAvatarRecord } from '@/src/lib/pool-leaderboard'
import type { PoolAnnouncement } from '@/src/lib/pool-announcements'

export type PoolHomeMeta = {
  inviteCode: string
  name: string
  description: string | null
  scoringStyle: string
  stage: string
  memberCount: number
  matchesPlayed: number
  totalMatches: number
  nextMatchIn: string | null
  nextMatchKickoffAt: string | null
  acceptingMembers: boolean
  avatar: string | null
  /** Custom uploaded emblem URL (nullable). */
  emblemUrl: string | null
  /** Hex accent; null = default primary. */
  themeColor: string | null
  eventId: string | null
  /** Classic custom scoring; null field → engine default. */
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
  scoringLockedAt: string | null
  /** True when scoring_locked_at set or scoring has started for this pool. */
  scoringLocked: boolean
}

interface PoolHomeViewProps {
  pool: PoolHomeMeta
  members: LeaderboardMember[]
  userPredictions: UserPoolPrediction[]
  currentUserId: string
  leaderboardLoading?: boolean
  /** Soft in-place refresh while live/recent finals — no skeleton flash. */
  leaderboardRefreshing?: boolean
  /** Event currently in the live / recent-final polling window. */
  leaderboardLiveSync?: boolean
  /** Soft-refresh / cache load failure message. */
  leaderboardError?: string | null
  onRetryLeaderboard?: () => void
  canDelete?: boolean
  poolId?: string
  memberId?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
  avatarsByMemberId: Map<string, MemberAvatarRecord>
  poolCreatorUserId?: string
  memberProfilesByUserId?: Map<string, PoolChatMemberProfile>
  isPoolOwner?: boolean
  isPoolAdmin?: boolean
  /** Owner has Commissioner tier — unlocks gated commissioner tools for this pool. */
  poolHasCommissionerTools?: boolean
  coAdminUserIds?: string[]
  onPoolNameChange?: (name: string) => void
  onPoolDescriptionChange?: (description: string | null) => void
  onAcceptingMembersChange?: (acceptingMembers: boolean) => void
  onPoolAvatarChange?: (avatar: string) => void
  onPoolThemeColorChange?: (themeColor: string | null) => void
  onPoolEmblemUrlChange?: (emblemUrl: string | null) => void
  onPoolScoringChange?: (scoring: {
    scoreExactPoints: number | null
    scoreWinnerPoints: number | null
    scoreDrawPoints: number | null
  }) => void
  onMemberRemoved?: (memberId: string) => void
  onOwnershipTransferred?: (newOwnerUserId: string) => void
  activeAnnouncement?: PoolAnnouncement | null
  onAnnouncementDismissed?: (announcementId: string) => void
  onManagedAnnouncementChange?: (announcement: PoolAnnouncement | null) => void
}

export function PoolHomeView({
  pool,
  members,
  userPredictions,
  currentUserId,
  leaderboardLoading = false,
  leaderboardRefreshing = false,
  leaderboardLiveSync = false,
  leaderboardError = null,
  onRetryLeaderboard,
  canDelete,
  poolId,
  memberId,
  onPredictionSaved,
  onPredictionRemoved,
  avatarsByMemberId,
  poolCreatorUserId,
  memberProfilesByUserId,
  isPoolOwner,
  isPoolAdmin,
  poolHasCommissionerTools = false,
  coAdminUserIds,
  onPoolNameChange,
  onPoolDescriptionChange,
  onAcceptingMembersChange,
  onPoolAvatarChange,
  onPoolThemeColorChange,
  onPoolEmblemUrlChange,
  onPoolScoringChange,
  onMemberRemoved,
  onOwnershipTransferred,
  activeAnnouncement = null,
  onAnnouncementDismissed,
  onManagedAnnouncementChange,
}: PoolHomeViewProps) {
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [reportPoolOpen, setReportPoolOpen] = useState(false)
  const searchParams = useSearchParams()
  const normalizeTab = (tab: string | null) => {
    if (tab === 'squad') return 'settings'
    if (
      tab === 'chat' ||
      tab === 'leaderboard' ||
      tab === 'predictions' ||
      tab === 'settings'
    ) {
      return tab
    }
    return 'predictions'
  }

  const [activeTab, setActiveTab] = useState(() =>
    normalizeTab(searchParams.get('tab')),
  )

  useEffect(() => {
    if (activeTab !== 'leaderboard') return
    capturePostHog('leaderboard_viewed', {
      type: 'pool',
      pool_id: poolId ?? null,
    })
  }, [activeTab, poolId])

  const copyInviteLink = () => {
    if (!pool.acceptingMembers) return
    const joinUrl = buildJoinInviteUrl(
      window.location.origin,
      pool.inviteCode,
      currentUserId,
    )
    capturePostHog('share_card_generated', { type: 'pool_invite' })
    void shareOrCopy({
      title: `Join ${pool.name} on PoolCup`,
      text: 'Join my prediction pool on PoolCup',
      url: joinUrl,
      imageUrl: `/api/share/pool/${encodeURIComponent(pool.inviteCode)}`,
      type: 'pool_invite',
    })
      .then(() => {
        trackEvent('invite_link_copied', {
          poolId: poolId ?? null,
          metadata: { source: 'pool_page' },
        })
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* abort / ignore */
      })
  }

  const inviteFromLeaderboard = () => {
    if (!pool.acceptingMembers) return
    copyInviteLink()
    trackEvent('invite_link_copied', {
      poolId: poolId ?? null,
      metadata: { source: 'pool_leaderboard' },
    })
  }

  // TEMPORARY — mock standings for design preview; flip USE_MOCK_LEADERBOARD off to restore.
  const leaderboardMembers = USE_MOCK_LEADERBOARD
    ? buildMockLeaderboardMembers(currentUserId)
    : members
  const leaderboardTabLoading = USE_MOCK_LEADERBOARD
    ? false
    : leaderboardLoading

  const isWinnerPool = pool.scoringStyle === 'winner'
  const hasResults =
    pool.matchesPlayed > 0 ||
    (isWinnerPool && members.some((member) => member.points > 0))
  const showPreMatchLeaderboardNote =
    !USE_MOCK_LEADERBOARD && !hasResults && members.length > 0
  const showChatTab = Boolean(memberId && poolId && poolCreatorUserId && memberProfilesByUserId)
  const isChatView = activeTab === 'chat' && showChatTab
  const isMobileChatShell = isChatView
  const { setMobileChatActive } = useMobileChatChrome()

  useEffect(() => {
    if (!pool.acceptingMembers) {
      setShareOpen(false)
    }
  }, [pool.acceptingMembers])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'chat') {
      setActiveTab(showChatTab ? 'chat' : 'predictions')
      return
    }
    if (
      tab === 'leaderboard' ||
      tab === 'predictions' ||
      tab === 'squad' ||
      tab === 'settings'
    ) {
      setActiveTab(normalizeTab(tab))
    }
  }, [searchParams, showChatTab])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)')

    const syncMobileChatActive = () => {
      setMobileChatActive(isMobileChatShell && mediaQuery.matches)
    }

    syncMobileChatActive()
    mediaQuery.addEventListener('change', syncMobileChatActive)

    return () => {
      mediaQuery.removeEventListener('change', syncMobileChatActive)
      setMobileChatActive(false)
    }
  }, [isMobileChatShell, setMobileChatActive])

  const isWinnerPredictionsTab = isWinnerPool && activeTab === 'predictions'
  const isClassicPredictionsTab = !isWinnerPool && activeTab === 'predictions'
  const isLeaderboardTab = activeTab === 'leaderboard'

  const handleBackClick = () => {
    console.log('back clicked', DASHBOARD_TAB_HREFS.dashboard)
    router.push(isChatView ? CHAT_INBOX_HREF : DASHBOARD_TAB_HREFS.dashboard)
  }

  return (
    <PoolThemeScope
      themeColor={pool.themeColor}
      className={cn(
        'min-h-screen bg-app-background',
        isLeaderboardTab && 'flex flex-col',
        !isMobileChatShell && MOBILE_BOTTOM_NAV_PAD_CLASS,
        isMobileChatShell &&
          'max-sm:flex max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
      )}
    >
      <div
        className={cn(
          'relative',
          isLeaderboardTab && 'flex min-h-0 flex-1 flex-col',
          isMobileChatShell &&
            'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-[100] isolate border-b',
            isChatView
              ? 'border-white/[0.08] bg-app-background'
              : 'border-border bg-app-background/80 backdrop-blur-xl',
            isLeaderboardTab && 'shrink-0',
            isMobileChatShell && 'max-sm:shrink-0',
          )}
        >
          <div
            className={cn(
              'mx-auto max-w-4xl px-4',
              isChatView ? 'py-2.5 sm:py-3' : 'py-4 max-sm:py-2.5',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-4',
                isChatView
                  ? 'gap-2'
                  : 'max-sm:items-start max-sm:gap-2',
              )}
            >
              <button
                type="button"
                onClick={handleBackClick}
                className="group relative z-[51] shrink-0 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-sm:p-1.5"
                aria-label={isChatView ? 'Back to chats' : 'Back to dashboard'}
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </button>

              {isChatView ? (
                <>
                  <h1 className="min-w-0 flex-1 truncate font-display text-xl tracking-wide text-foreground sm:text-2xl">
                    {pool.name}
                  </h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Chat options"
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => {
                          setActiveTab('settings')
                        }}
                      >
                        Pool settings
                      </DropdownMenuItem>
                      {poolId ? (
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            setReportPoolOpen(true)
                          }}
                        >
                          Report pool
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {poolId ? (
                    <ReportPoolControl
                      poolId={poolId}
                      open={reportPoolOpen}
                      onOpenChange={setReportPoolOpen}
                      showTrigger={false}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <PoolAvatarImage
                    avatar={pool.avatar}
                    emblemUrl={pool.emblemUrl}
                    size="sm"
                    className="shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="hidden sm:block">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                          {pool.name}
                        </h1>
                        <ScoringModeBadge scoringStyle={pool.scoringStyle} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {pool.acceptingMembers ? (
                          <>
                            <span>Invite:</span>
                            <code className="font-mono text-primary">{pool.inviteCode}</code>
                          </>
                        ) : (
                          <span className="font-medium text-amber-400">Invites closed</span>
                        )}
                      </div>
                    </div>
                    <div className="sm:hidden">
                      <h1 className="truncate font-display text-lg tracking-wide text-foreground">
                        {pool.name}
                      </h1>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <ScoringModeBadge
                          scoringStyle={pool.scoringStyle}
                          className="shrink-0"
                        />
                        {pool.acceptingMembers ? (
                          <div className="flex min-w-0 items-center gap-1.5 truncate rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                            <span className="shrink-0">Invite:</span>
                            <code className="truncate font-mono text-primary">
                              {pool.inviteCode}
                            </code>
                          </div>
                        ) : (
                          <div className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            Invites closed
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {canDelete && poolId ? (
                    <DeletePoolDialog
                      poolId={poolId}
                      poolName={pool.name}
                      redirectTo="/dashboard"
                      triggerVariant="outline"
                      mobileIconOnly
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </header>

        <main
          className={cn(
            'relative z-0 mx-auto w-full min-w-0 py-8',
            'max-sm:pt-0 max-sm:pb-8',
            // Leaderboard list is full-bleed; drop max-width + side padding on this tab only.
            isLeaderboardTab
              ? 'flex max-w-none flex-1 flex-col bg-app-background px-0 pb-0'
              : 'max-w-4xl bg-app-background px-4',
            isMobileChatShell &&
              'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden max-sm:px-0 max-sm:py-0 max-sm:pb-0',
          )}
        >
          {!isChatView && activeAnnouncement ? (
            <div
              className={cn(
                'mb-4',
                isLeaderboardTab && 'mx-auto max-w-4xl px-4',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4 max-sm:pt-3',
                !isMobileChatShell && 'max-sm:mt-3',
              )}
            >
              <PoolAnnouncementBanner
                announcement={activeAnnouncement}
                onDismissed={(id) => onAnnouncementDismissed?.(id)}
              />
            </div>
          ) : null}

          {!isChatView && poolId ? (
            <div
              className={cn(
                'mb-4',
                isLeaderboardTab && 'mx-auto max-w-4xl px-4',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4',
              )}
            >
              <SoloInviteNudge
                inviteCode={pool.inviteCode}
                poolId={poolId}
                poolName={pool.name}
                memberCount={pool.memberCount}
                acceptingMembers={pool.acceptingMembers}
              />
            </div>
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={cn(
              'mb-8 w-full min-w-0 gap-6',
              isLeaderboardTab && 'mb-0 flex min-h-0 flex-1 flex-col gap-4',
              isMobileChatShell &&
                'max-sm:mb-0 max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
              isMobileChatShell && isChatView && 'max-sm:gap-0',
            )}
          >
            <div
              className={cn(
                'max-sm:mt-3',
                isLeaderboardTab && 'mx-auto w-full max-w-4xl shrink-0 px-4',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4',
                isChatView && 'max-sm:mt-0',
              )}
            >
              {!isChatView ? (
                <div className="flex flex-wrap items-center gap-2">
                  <TabsList
                    className={cn(
                      'grid h-auto w-full max-w-2xl grid-cols-3 p-1',
                      isMobileChatShell && 'max-sm:max-w-none max-sm:shrink-0',
                    )}
                  >
                    <TabsTrigger value="predictions" className="px-2 py-2 text-xs sm:text-sm">
                      Predictions
                    </TabsTrigger>
                    <TabsTrigger value="leaderboard" className="px-2 py-2 text-xs sm:text-sm">
                      Leaderboard
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="px-2 py-2 text-xs sm:text-sm">
                      <span className="sm:hidden">Settings</span>
                      <span className="hidden sm:inline">Pool Settings</span>
                    </TabsTrigger>
                  </TabsList>
                  {isLeaderboardTab && USE_MOCK_LEADERBOARD ? (
                    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      Mock preview
                    </span>
                  ) : null}
                  {isLeaderboardTab && !USE_MOCK_LEADERBOARD && leaderboardRefreshing ? (
                    <span
                      className="shrink-0 animate-pulse text-[11px] font-medium tracking-wide text-muted-foreground"
                      aria-live="polite"
                    >
                      Updating…
                    </span>
                  ) : null}
                  {isLeaderboardTab &&
                  !USE_MOCK_LEADERBOARD &&
                  !leaderboardRefreshing &&
                  leaderboardLiveSync ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium tracking-wide text-primary"
                      aria-label="Live standings sync on"
                    >
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_6px_color-mix(in_srgb,var(--primary)_70%,transparent)]"
                        aria-hidden
                      />
                      Live
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <TabsContent
              value="predictions"
              className={cn(
                'mt-0 w-full min-w-0',
                isWinnerPredictionsTab && 'overflow-x-visible',
                isClassicPredictionsTab && 'overflow-x-hidden',
              )}
            >
              <PoolPredictionsTab
                scoringStyle={pool.scoringStyle}
                predictions={userPredictions}
                totalMatchCount={pool.totalMatches}
                acceptingMembers={pool.acceptingMembers}
                poolId={poolId}
                memberId={memberId}
                currentUserId={currentUserId}
                inviteCode={pool.inviteCode}
                winnerPool={
                  isWinnerPool && poolId
                    ? {
                        id: poolId,
                        name: pool.name,
                        invite_code: pool.inviteCode,
                        scoring_style: pool.scoringStyle,
                        event_id: pool.eventId,
                      }
                    : undefined
                }
                onPredictionSaved={onPredictionSaved}
                onPredictionRemoved={onPredictionRemoved}
                shareOpen={shareOpen}
                onToggleShare={() => setShareOpen((o) => !o)}
                inviteCopySlot={
                  pool.acceptingMembers ? (
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <h3 className="mb-4 font-display text-lg">Invite Friends</h3>
                      <PoolInviteCard
                        inviteCode={pool.inviteCode}
                        poolId={poolId}
                        poolName={pool.name}
                        source="pool_predictions_share"
                      />
                      <p className="mt-4 text-sm text-muted-foreground">
                        Share this link with friends so they can join your prediction
                        pool
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                      <p className="font-medium text-foreground">Invites closed</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        New members cannot join while invites are closed. Turn accepting
                        new members back on in Pool Settings to share your invite link
                        again.
                      </p>
                    </div>
                  )
                }
              />
            </TabsContent>

            <TabsContent
              value="leaderboard"
              className="mt-0 flex min-h-0 w-full min-w-0 flex-1 flex-col"
            >
              {leaderboardTabLoading ? (
                <div className="mx-auto max-w-4xl px-4">
                  <LeaderboardSkeleton />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {leaderboardError ? (
                    <div
                      className="mx-auto mb-3 w-full max-w-4xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center"
                      role="alert"
                    >
                      <p className="text-sm text-destructive">
                        Couldn’t refresh standings.
                      </p>
                      {onRetryLeaderboard ? (
                        <button
                          type="button"
                          onClick={onRetryLeaderboard}
                          className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
                        >
                          Try again
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <PoolLeaderboardStandings
                    members={leaderboardMembers}
                    acceptingMembers={pool.acceptingMembers}
                    copied={copied}
                    onInvite={inviteFromLeaderboard}
                    showPreMatchNote={showPreMatchLeaderboardNote}
                    poolId={poolId}
                    inviteCode={pool.inviteCode}
                    className="min-h-0 flex-1"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-0 w-full min-w-0">
              <PoolSettingsTab
                poolId={poolId}
                poolName={pool.name}
                poolDescription={pool.description}
                inviteCode={pool.inviteCode}
                poolThemeColor={pool.themeColor}
                poolAvatar={pool.avatar}
                poolEmblemUrl={pool.emblemUrl}
                scoringStyle={pool.scoringStyle}
                scoreExactPoints={pool.scoreExactPoints}
                scoreWinnerPoints={pool.scoreWinnerPoints}
                scoreDrawPoints={pool.scoreDrawPoints}
                scoringLocked={pool.scoringLocked}
                acceptingMembers={pool.acceptingMembers}
                members={members}
                poolCreatorUserId={poolCreatorUserId}
                currentUserId={currentUserId}
                isOwner={isPoolOwner}
                isAdmin={isPoolAdmin}
                poolHasCommissionerTools={poolHasCommissionerTools}
                coAdminUserIds={coAdminUserIds}
                onPoolNameChange={onPoolNameChange}
                onPoolDescriptionChange={onPoolDescriptionChange}
                onPoolThemeColorChange={onPoolThemeColorChange}
                onPoolEmblemUrlChange={onPoolEmblemUrlChange}
                onPoolScoringChange={onPoolScoringChange}
                onAcceptingMembersChange={onAcceptingMembersChange}
                onMemberRemoved={onMemberRemoved}
                onOwnershipTransferred={onOwnershipTransferred}
                onManagedAnnouncementChange={onManagedAnnouncementChange}
              />
            </TabsContent>

            {showChatTab && poolId && poolCreatorUserId && memberProfilesByUserId ? (
              <TabsContent
                value="chat"
                className={cn(
                  'mt-0 w-full min-w-0',
                  'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-hidden',
                )}
              >
                <div className="mb-1.5 pt-2 pb-1 max-sm:shrink-0 max-sm:px-4 sm:mb-3 sm:pt-3 sm:pb-2">
                  <LiveScoreboard compact eventId={pool.eventId} />
                </div>
                {isChatView ? (
                  <PoolChatTab
                    hideHeading
                    fullBleedMobile
                    poolId={poolId}
                    currentUserId={currentUserId}
                    poolCreatorUserId={poolCreatorUserId}
                    memberProfilesByUserId={memberProfilesByUserId}
                  />
                ) : null}
              </TabsContent>
            ) : null}
          </Tabs>
        </main>
      </div>
    </PoolThemeScope>
  )
}
