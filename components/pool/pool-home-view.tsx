'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  MoreVertical,
  Settings,
  Share2,
  Target,
  Trophy,
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
import { ReportPoolControl } from '@/components/pool/report-pool-control'
import { PoolAnnouncementBanner } from '@/components/pool/pool-announcement-banner'
import { SoloInviteNudge } from '@/components/pool/solo-invite-nudge'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { PoolPredictionsTab } from '@/components/pool/pool-predictions-tab'
import { PoolLeaderboardStandings } from '@/components/pool/pool-leaderboard-standings'
import { PoolSettingsDialog } from '@/components/pool/pool-settings-dialog'
import { PoolSettingsMobileTab } from '@/components/pool/pool-settings-mobile-tab'
import {
  USE_MOCK_LEADERBOARD,
  buildMockLeaderboardMembers,
} from '@/components/pool/mock-leaderboard-preview'
import {
  PoolPredictionStatusFilterProvider,
  PredictionStatusFilterTabs,
} from '@/src/lib/pool-prediction-status-filter-context'
import {
  PoolChatTab,
  type PoolChatMemberProfile,
} from '@/components/pool/pool-chat-tab'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
} from '@/src/lib/mobile-bottom-nav-routes'
import { trackEvent } from '@/src/lib/track'
import { capturePostHog } from '@/src/lib/posthog-client'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import {
  POOL_SETTINGS_MODAL_MQ,
  shouldOpenPoolSettingsModal,
} from '@/src/lib/pool-settings-nav'
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
  isPublic: boolean
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
  poolId?: string
  memberId?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
    advancePick?: number | null,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
  poolCreatorUserId?: string
  memberProfilesByUserId?: Map<string, PoolChatMemberProfile>
  isPoolOwner?: boolean
  isPoolAdmin?: boolean
  poolHasCommissionerTools?: boolean
  coAdminUserIds?: string[]
  onPoolNameChange?: (name: string) => void
  onPoolDescriptionChange?: (description: string | null) => void
  onAcceptingMembersChange?: (acceptingMembers: boolean) => void
  onIsPublicChange?: (isPublic: boolean) => void
  onPoolThemeColorChange?: (themeColor: string | null) => void
  onPoolEmblemUrlChange?: (emblemUrl: string | null) => void
  onPoolScoringChange?: (scoring: {
    scoreExactPoints: number | null
    scoreWinnerPoints: number | null
    scoreDrawPoints: number | null
  }) => void
  onMemberRemoved?: (memberId: string) => void
  onOwnershipTransferred?: (newOwnerUserId: string) => void
  onManagedAnnouncementChange?: (
    announcement: PoolAnnouncement | null,
  ) => void
  activeAnnouncement?: PoolAnnouncement | null
  onAnnouncementDismissed?: (announcementId: string) => void
}

function PoolShareButton({
  acceptingMembers,
  copied,
  onClick,
  className,
}: {
  acceptingMembers: boolean
  copied: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={!acceptingMembers}
      aria-label={acceptingMembers ? 'Share pool' : 'Invites closed'}
      className={cn(
        'shrink-0 gap-1.5 font-display tracking-wide',
        FOCUS_VISIBLE_RING,
        !acceptingMembers &&
          'cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400',
        className,
      )}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      {acceptingMembers ? (copied ? 'Copied' : 'Share Pool') : 'Invites closed'}
    </Button>
  )
}

const POOL_TAB_TRIGGER_CLASS =
  'h-auto flex-col gap-0.5 whitespace-nowrap px-1.5 py-1.5 text-[10px] leading-none lg:flex-row lg:gap-1.5 lg:px-2 lg:py-2 lg:text-sm lg:leading-normal'

/** Desktop vertical section rail (lg+ only). Yields width before the workspace. */
const POOL_DESKTOP_NAV_TRIGGER_CLASS = cn(
  'inline-flex h-auto w-full min-w-0 items-center justify-start gap-2 rounded-lg px-2 py-2 text-xs font-medium sm:text-[0.8125rem]',
  'text-muted-foreground transition-[transform,background-color,color] duration-150',
  'hover:bg-muted/80 hover:text-foreground active:translate-y-px',
  'data-[state=active]:bg-primary/15 data-[state=active]:text-primary',
  FOCUS_VISIBLE_RING,
)

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
  poolId,
  memberId,
  onPredictionSaved,
  onPredictionRemoved,
  poolCreatorUserId,
  memberProfilesByUserId,
  isPoolOwner,
  isPoolAdmin,
  poolHasCommissionerTools = false,
  coAdminUserIds,
  onPoolNameChange,
  onPoolDescriptionChange,
  onAcceptingMembersChange,
  onIsPublicChange,
  onPoolThemeColorChange,
  onPoolEmblemUrlChange,
  onPoolScoringChange,
  onMemberRemoved,
  onOwnershipTransferred,
  onManagedAnnouncementChange,
  activeAnnouncement = null,
  onAnnouncementDismissed,
}: PoolHomeViewProps) {
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [reportPoolOpen, setReportPoolOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const media = window.matchMedia(POOL_SETTINGS_MODAL_MQ)
    const syncDesktopSettings = () => {
      if (!media.matches) {
        setSettingsOpen(false)
        return
      }
      setActiveTab((current) => {
        if (current !== 'settings') return current
        setSettingsOpen(true)
        return 'predictions'
      })
    }
    syncDesktopSettings()
    media.addEventListener('change', syncDesktopSettings)
    return () => media.removeEventListener('change', syncDesktopSettings)
  }, [])

  const normalizeTab = (tab: string | null) => {
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
        if (poolId) {
          capturePostHog('invite_link_copied', { pool_id: poolId })
        }
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

  function openSettingsFromNav(event?: {
    preventDefault: () => void
  }) {
    if (shouldOpenPoolSettingsModal()) {
      event?.preventDefault()
      setSettingsOpen(true)
      return true
    }
    setActiveTab('settings')
    return true
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
    const tab = searchParams.get('tab')
    if (tab === 'chat') {
      setActiveTab(showChatTab ? 'chat' : 'predictions')
      return
    }
    if (tab === 'settings') {
      if (shouldOpenPoolSettingsModal()) {
        setSettingsOpen(true)
        setActiveTab('predictions')
        return
      }
      setActiveTab('settings')
      return
    }
    if (tab === 'leaderboard' || tab === 'predictions') {
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
              'mx-auto w-full px-4',
              // Match main content edges on desktop (classic predictions uses ~82rem).
              isClassicPredictionsTab
                ? 'max-w-4xl lg:max-w-[82rem]'
                : 'max-w-4xl',
              isChatView ? 'py-2.5 sm:py-3' : 'py-4 max-sm:py-2.5',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-4',
                isChatView ? 'gap-2' : 'max-lg:gap-2',
              )}
            >
              {isChatView ? (
                <>
                  <button
                    type="button"
                    onClick={handleBackClick}
                    className="group relative z-[51] shrink-0 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-sm:p-1.5"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </button>
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
                          openSettingsFromNav()
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
                  <div className="flex min-w-0 flex-1 items-center gap-4 max-lg:gap-2">
                    <button
                      type="button"
                      onClick={handleBackClick}
                      className="group relative z-[51] shrink-0 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-sm:p-1.5"
                      aria-label="Back to dashboard"
                    >
                      <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </button>
                    <PoolAvatarImage
                      avatar={pool.avatar}
                      emblemUrl={pool.emblemUrl}
                      size="sm"
                      className="shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="hidden lg:block">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                            {pool.name}
                          </h1>
                          <ScoringModeBadge scoringStyle={pool.scoringStyle} />
                        </div>
                      </div>
                      <div className="lg:hidden">
                        <h1 className="w-full min-w-0 max-w-none truncate font-display text-lg tracking-wide text-foreground">
                          {pool.name}
                        </h1>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <ScoringModeBadge
                            scoringStyle={pool.scoringStyle}
                            className="shrink-0"
                          />
                          <PoolShareButton
                            acceptingMembers={pool.acceptingMembers}
                            copied={copied}
                            onClick={copyInviteLink}
                            className="h-7 gap-1 px-2 text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <PoolShareButton
                    acceptingMembers={pool.acceptingMembers}
                    copied={copied}
                    onClick={copyInviteLink}
                    className="hidden shrink-0 lg:inline-flex"
                  />
                </>
              )}
            </div>
          </div>
        </header>

        <main
          className={cn(
            'relative z-0 mx-auto w-full min-w-0 py-8',
            // Own the top inset for all non-chat pool content (banners + tabs)
            // so first child never hugs the sticky header. Matches mb-4 rhythm.
            'max-sm:pt-4 max-sm:pb-8',
            // Leaderboard list is full-bleed; drop max-width + side padding on this tab only.
            isLeaderboardTab
              ? 'flex max-w-none flex-1 flex-col bg-app-background px-0 pb-0'
              : isClassicPredictionsTab
                ? 'max-w-[82rem] bg-app-background px-4'
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
                'mb-4 lg:hidden',
                isLeaderboardTab && 'mx-auto max-w-4xl px-4',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4',
              )}
            >
              <SoloInviteNudge
                inviteCode={pool.inviteCode}
                poolId={poolId}
                memberCount={pool.memberCount}
                acceptingMembers={pool.acceptingMembers}
              />
            </div>
          ) : null}

          <PoolPredictionStatusFilterProvider>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (value === 'settings') {
                if (shouldOpenPoolSettingsModal()) {
                  setSettingsOpen(true)
                  return
                }
                setActiveTab('settings')
                return
              }
              setActiveTab(value)
            }}
            className={cn(
              'mb-8 w-full min-w-0 gap-6',
              'lg:flex lg:flex-row lg:items-start lg:gap-4',
              isLeaderboardTab && 'mb-0 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row',
              isMobileChatShell &&
                'max-sm:mb-0 max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
              isMobileChatShell && isChatView && 'max-sm:gap-0',
            )}
          >
            {!isChatView ? (
              <nav
                className={cn(
                  // Prefer 12rem; high shrink so the predictions workspace wins width first.
                  'hidden min-w-[8.75rem] max-w-[12rem] basis-[12rem] shrink-[3] grow-0 lg:block',
                  'lg:sticky lg:top-24 lg:self-start',
                )}
                aria-label="Pool sections"
              >
                <div className="rounded-xl border border-border/80 bg-card/40 p-2">
                  <TabsList className="flex h-auto w-full flex-col gap-0.5 bg-transparent p-0">
                    <TabsTrigger
                      value="predictions"
                      className={POOL_DESKTOP_NAV_TRIGGER_CLASS}
                    >
                      <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">Predictions</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="leaderboard"
                      className={POOL_DESKTOP_NAV_TRIGGER_CLASS}
                    >
                      <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">Leaderboard</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className={POOL_DESKTOP_NAV_TRIGGER_CLASS}
                    >
                      <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">Settings</span>
                    </TabsTrigger>
                  </TabsList>
                  {isClassicPredictionsTab ? (
                    <PredictionStatusFilterTabs className="mt-1" />
                  ) : null}
                  {isLeaderboardTab && USE_MOCK_LEADERBOARD ? (
                    <span className="mt-2 block rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      Mock preview
                    </span>
                  ) : null}
                  {isLeaderboardTab &&
                  !USE_MOCK_LEADERBOARD &&
                  leaderboardRefreshing ? (
                    <span
                      className="mt-2 block animate-pulse text-center text-[11px] font-medium tracking-wide text-muted-foreground"
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
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-primary"
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
              </nav>
            ) : null}

            <div className="min-w-0 flex-1 basis-[70rem] shrink lg:min-h-0">
            <div
              className={cn(
                'lg:hidden',
                isLeaderboardTab && 'mx-auto w-full max-w-4xl shrink-0 px-4',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4',
              )}
            >
              {!isChatView ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <TabsList
                    className={cn(
                      'grid h-auto w-full max-w-2xl grid-cols-3 p-1',
                      'mx-auto w-[min(100%,19rem)] p-0.5',
                      isMobileChatShell && 'max-sm:shrink-0',
                    )}
                  >
                    <TabsTrigger
                      value="predictions"
                      className={POOL_TAB_TRIGGER_CLASS}
                    >
                      <Target className="h-3.5 w-3.5" aria-hidden />
                      Predictions
                    </TabsTrigger>
                    <TabsTrigger
                      value="leaderboard"
                      className={POOL_TAB_TRIGGER_CLASS}
                    >
                      <Trophy className="h-3.5 w-3.5" aria-hidden />
                      Leaderboard
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className={POOL_TAB_TRIGGER_CLASS}
                    >
                      <Settings className="h-3.5 w-3.5" aria-hidden />
                      Settings
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
                poolId={poolId}
                memberId={memberId}
                currentUserId={currentUserId}
                inviteCode={pool.inviteCode}
                poolName={pool.name}
                memberCount={pool.memberCount}
                userRank={
                  members.find(
                    (member) =>
                      member.isYou || member.userId === currentUserId,
                  )?.rank ?? null
                }
                acceptingMembers={pool.acceptingMembers}
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

            <TabsContent
              value="settings"
              className="mt-0 w-full min-w-0 lg:hidden"
            >
              <PoolSettingsMobileTab
                initialSection={searchParams.get('section')}
                tabProps={{
                  poolId,
                  poolName: pool.name,
                  poolDescription: pool.description,
                  inviteCode: pool.inviteCode,
                  poolThemeColor: pool.themeColor,
                  poolAvatar: pool.avatar,
                  poolEmblemUrl: pool.emblemUrl,
                  scoringStyle: pool.scoringStyle,
                  scoreExactPoints: pool.scoreExactPoints,
                  scoreWinnerPoints: pool.scoreWinnerPoints,
                  scoreDrawPoints: pool.scoreDrawPoints,
                  scoringLocked: pool.scoringLocked,
                  acceptingMembers: pool.acceptingMembers,
                  isPublic: pool.isPublic,
                  members,
                  poolCreatorUserId,
                  currentUserId,
                  isOwner: isPoolOwner,
                  isAdmin: isPoolAdmin,
                  poolHasCommissionerTools,
                  coAdminUserIds,
                  onPoolNameChange,
                  onPoolDescriptionChange,
                  onPoolThemeColorChange,
                  onPoolEmblemUrlChange,
                  onPoolScoringChange,
                  onAcceptingMembersChange,
                  onIsPublicChange,
                  onMemberRemoved,
                  onOwnershipTransferred,
                  onManagedAnnouncementChange,
                }}
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
            </div>
          </Tabs>
          </PoolPredictionStatusFilterProvider>
        </main>
      </div>
      <PoolSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tabProps={{
          poolId,
          poolName: pool.name,
          poolDescription: pool.description,
          inviteCode: pool.inviteCode,
          poolThemeColor: pool.themeColor,
          poolAvatar: pool.avatar,
          poolEmblemUrl: pool.emblemUrl,
          scoringStyle: pool.scoringStyle,
          scoreExactPoints: pool.scoreExactPoints,
          scoreWinnerPoints: pool.scoreWinnerPoints,
          scoreDrawPoints: pool.scoreDrawPoints,
          scoringLocked: pool.scoringLocked,
          acceptingMembers: pool.acceptingMembers,
          isPublic: pool.isPublic,
          members,
          poolCreatorUserId,
          currentUserId,
          isOwner: isPoolOwner,
          isAdmin: isPoolAdmin,
          poolHasCommissionerTools,
          coAdminUserIds,
          onPoolNameChange,
          onPoolDescriptionChange,
          onPoolThemeColorChange,
          onPoolEmblemUrlChange,
          onPoolScoringChange,
          onAcceptingMembersChange,
          onIsPublicChange,
          onMemberRemoved,
          onOwnershipTransferred,
          onManagedAnnouncementChange,
        }}
      />
    </PoolThemeScope>
  )
}
