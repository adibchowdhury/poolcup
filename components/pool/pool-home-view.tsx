'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Flag,
  LogOut,
  MoreVertical,
  Settings,
  Share2,
  Target,
  Trophy,
  UserPlus,
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
import { LeavePoolDialog } from '@/components/pool/leave-pool-dialog'
import { ReportPoolControl } from '@/components/pool/report-pool-control'
import {
  ReportIssueButton,
  useReportIssue,
} from '@/components/report-issue-dialog'
import { PoolAnnouncementBanner } from '@/components/pool/pool-announcement-banner'
import { SoloInviteNudge } from '@/components/pool/solo-invite-nudge'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { PoolPredictionsTab } from '@/components/pool/pool-predictions-tab'
import { PoolLeaderboardStandings } from '@/components/pool/pool-leaderboard-standings'
import { PoolDesktopTopBar, POOL_DESKTOP_CONTENT_RAIL_CLASS } from '@/components/pool/pool-desktop-top-bar'
import { PoolDesktopSidebar } from '@/components/pool/pool-desktop-sidebar'
import { PoolSettingsDesktopShell } from '@/components/pool/pool-settings-desktop-shell'
import { PoolSettingsMobileTab } from '@/components/pool/pool-settings-mobile-tab'
import {
  PoolMobileTabCarousel,
  POOL_TAB_CAROUSEL_MS,
  type PoolMobileTabCarouselHandle,
} from '@/components/pool/pool-mobile-tab-carousel'
import { PoolHomeShell } from '@/components/pool/pool-home-shell'
import { PoolUpgradeDesktopView } from '@/components/pool/pool-upgrade-desktop-view'
import { PoolUpgradeMobileSheet } from '@/components/pool/pool-upgrade-mobile-sheet'
import {
  USE_MOCK_LEADERBOARD,
  buildMockLeaderboardMembers,
} from '@/components/pool/mock-leaderboard-preview'
import {
  PoolPredictionStatusFilterProvider,
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
  MOBILE_BOTTOM_NAV_PAD_CLASS,
} from '@/src/lib/mobile-bottom-nav-routes'
import {
  POOL_MOBILE_CONTENT_PAD_CLASS,
  POOL_MOBILE_TAB_INDICATOR_CLASS,
  POOL_MOBILE_TAB_LIST_CLASS,
  POOL_MOBILE_TAB_TRIGGER_CLASS,
  POOL_OVERFLOW_MENU_CONTENT_CLASS,
  POOL_OVERFLOW_MENU_ITEM_CLASS,
  POOL_OVERFLOW_MENU_ITEM_DESTRUCTIVE_CLASS,
} from '@/src/lib/pool-mobile-chrome'
import { trackEvent } from '@/src/lib/track'
import { capturePostHog } from '@/src/lib/posthog-client'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import { usePoolSettingsMobileTab } from '@/hooks/use-pool-settings-mobile-tab'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import {
  isPoolMobileSwipeTab,
  POOL_MOBILE_SWIPE_TABS,
  usePoolTabSwipe,
  type PoolMobileSwipeTab,
} from '@/hooks/use-pool-tab-swipe'
import {
  poolHomePath,
  poolPagePath,
  poolSettingsPath,
  poolUpgradePath,
  parsePoolHomeFromPath,
  parsePoolUpgradeFromPath,
  readPoolSettingsClientRoute,
  shallowPoolSettingsUrl,
  shouldUsePoolSettingsMobileTab,
} from '@/src/lib/pool-settings-nav'
import type { PoolAnnouncement } from '@/src/lib/pool-announcements'
import {
  POOL_DESKTOP_CANVAS_CLASS,
  POOL_DESKTOP_CHROME_SURFACE_CLASS,
} from '@/src/lib/dashboard-surfaces'

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
  /** pools.created_at — ISO; used as sidebar “Kickoff” display. */
  createdAt?: string | null
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
  /** World Cup group-standings Winner Only (legacy); per-match when false. */
  legacyWinnerOnly?: boolean
  /** sporting_events.sport for draw eligibility in Winner Only picks. */
  eventSport?: string | null
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
  const [leavePoolOpen, setLeavePoolOpen] = useState(false)
  /** Tab to restore when leaving mobile settings via back. */
  const [tabBeforeSettings, setTabBeforeSettings] = useState('predictions')
  const searchParams = useSearchParams()
  const { openReportIssue } = useReportIssue()
  const swipeRootRef = useRef<HTMLDivElement | null>(null)

  const normalizeTab = (tab: string | null) => {
    if (
      tab === 'chat' ||
      tab === 'home' ||
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
  const [isUpgradeView, setIsUpgradeView] = useState(false)
  /** Single source of truth for upgrade/settings chrome: below lg = mobile. */
  const isPoolMobile = usePoolSettingsMobileTab()

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
    event?.preventDefault()
    if (activeTab !== 'settings') {
      setTabBeforeSettings(activeTab)
    }
    setActiveTab('settings')
    if (shouldUsePoolSettingsMobileTab()) {
      const params = new URLSearchParams(window.location.search)
      params.set('tab', 'settings')
      params.delete('upgrade')
      shallowPoolSettingsUrl(
        `${poolPagePath(pool.inviteCode)}?${params.toString()}`,
        'push',
      )
      return true
    }
    shallowPoolSettingsUrl(
      poolSettingsPath(pool.inviteCode, 'details'),
      'push',
    )
    return true
  }

  function openPoolUpgrade() {
    // Rule: below lg → popup; lg+ → navigate to /upgrade page (never open sheet).
    if (shouldUsePoolSettingsMobileTab()) {
      setIsUpgradeView(true)
      const params = new URLSearchParams(window.location.search)
      params.set('upgrade', '1')
      if (activeTab === 'settings') {
        params.set('tab', 'settings')
      } else if (!params.get('tab')) {
        params.set('tab', activeTab)
      }
      shallowPoolSettingsUrl(
        `${poolPagePath(pool.inviteCode)}?${params.toString()}`,
        'push',
      )
      return
    }
    setIsUpgradeView(false)
    router.push(poolUpgradePath(pool.inviteCode))
  }

  function closePoolUpgrade() {
    setIsUpgradeView(false)
    if (shouldUsePoolSettingsMobileTab()) {
      const params = new URLSearchParams(window.location.search)
      params.delete('upgrade')
      if (params.get('tab') === 'upgrade') {
        params.set('tab', 'settings')
      }
      const qs = params.toString()
      shallowPoolSettingsUrl(
        qs
          ? `${poolPagePath(pool.inviteCode)}?${qs}`
          : poolPagePath(pool.inviteCode),
        'replace',
      )
      return
    }
    router.push(poolSettingsPath(pool.inviteCode, 'details'))
  }

  function syncDesktopPoolTabUrl(tab: string) {
    if (shouldUsePoolSettingsMobileTab()) return
    if (tab === 'home') {
      shallowPoolSettingsUrl(poolHomePath(pool.inviteCode), 'push')
      return
    }
    if (tab === 'settings') {
      shallowPoolSettingsUrl(poolSettingsPath(pool.inviteCode, 'details'), 'push')
      return
    }
    shallowPoolSettingsUrl(
      `${poolPagePath(pool.inviteCode)}?tab=${encodeURIComponent(tab)}`,
      'push',
    )
  }

  const reducedMotion = usePrefersReducedMotion()
  /**
   * Carousel + underline share this index. Tap/swipe call goToSwipeTab which
   * applies the track transform imperatively (same frame), then syncs this state.
   * Retained when leaving for settings/chat so return does not jump the track.
   */
  const [carouselIndex, setCarouselIndex] = useState(() => {
    const initial = normalizeTab(searchParams.get('tab'))
    return isPoolMobileSwipeTab(initial)
      ? POOL_MOBILE_SWIPE_TABS.indexOf(initial)
      : 0
  })

  const carouselRef = useRef<PoolMobileTabCarouselHandle | null>(null)
  const tabIndicatorRef = useRef<HTMLSpanElement | null>(null)

  const applyCarouselVisual = useCallback(
    (index: number) => {
      carouselRef.current?.goToIndex(index, { animate: !reducedMotion })
      const ind = tabIndicatorRef.current
      if (ind) {
        ind.style.transform = `translate3d(${index * 100}%, 0, 0)`
      }
      // Kick style/layout so the transition is pending before we yield to paint.
      void tabIndicatorRef.current?.offsetWidth
    },
    [reducedMotion],
  )

  const syncSwipeTabUrl = useCallback(
    (tab: PoolMobileSwipeTab) => {
      if (shouldUsePoolSettingsMobileTab()) {
        const params = new URLSearchParams(window.location.search)
        params.set('tab', tab)
        params.delete('upgrade')
        shallowPoolSettingsUrl(
          `${poolPagePath(pool.inviteCode)}?${params.toString()}`,
          'replace',
        )
        return
      }
      if (tab === 'home') {
        shallowPoolSettingsUrl(poolHomePath(pool.inviteCode), 'push')
        return
      }
      shallowPoolSettingsUrl(
        `${poolPagePath(pool.inviteCode)}?tab=${encodeURIComponent(tab)}`,
        'push',
      )
    },
    [pool.inviteCode],
  )

  const goToSwipeTab = useCallback(
    (tab: PoolMobileSwipeTab) => {
      const t0 =
        typeof performance !== 'undefined' ? performance.now() : 0
      const idx = POOL_MOBILE_SWIPE_TABS.indexOf(tab)
      // SAME FRAME as tap: compositor transform only — no setState here.
      applyCarouselVisual(idx)
      const tAfterVisual =
        typeof performance !== 'undefined' ? performance.now() : 0
      if (typeof window !== 'undefined') {
        ;(
          window as Window & {
            __poolTabTapMarks?: Record<string, number | string>
          }
        ).__poolTabTapMarks = {
          tab,
          t0,
          msToAfterVisual: tAfterVisual - t0,
          carouselIndexVia: 'imperative-before-paint',
          urlMode: 'pending',
        }
      }
      // Yield past the next paint: rAF runs before paint; setTimeout(0) runs after.
      // Sync setActiveTab re-renders the heavy pane tree (~500ms+) and must not
      // block that first slide frame.
      requestAnimationFrame(() => {
        setTimeout(() => {
          setCarouselIndex(idx)
          setActiveTab(tab)
          setIsUpgradeView(false)
          const tAfterState =
            typeof performance !== 'undefined' ? performance.now() : 0
          syncSwipeTabUrl(tab)
          const tAfterUrl =
            typeof performance !== 'undefined' ? performance.now() : 0
          if (typeof window !== 'undefined') {
            const marks = (
              window as Window & {
                __poolTabTapMarks?: Record<string, number | string>
              }
            ).__poolTabTapMarks
            if (marks) {
              marks.msToAfterState = tAfterState - t0
              marks.msToAfterUrl = tAfterUrl - t0
              marks.urlMode = 'raf-timeout-deferred-shallow'
              marks.carouselIndexVia = 'imperative-then-post-paint-setState'
            }
          }
        }, 0)
      })
    },
    [applyCarouselVisual, syncSwipeTabUrl],
  )

  const { onTouchStart, onTouchEnd, onTouchCancel } = usePoolTabSwipe({
    enabled: isPoolMobile && !isUpgradeView && activeTab !== 'chat',
    activeTab,
    onSwipeTab: goToSwipeTab,
    rootRef: swipeRootRef,
  })

  // External activeTab changes (popstate / searchParams) — keep index in sync only.
  useEffect(() => {
    if (!isPoolMobileSwipeTab(activeTab)) return
    const idx = POOL_MOBILE_SWIPE_TABS.indexOf(activeTab)
    setCarouselIndex((prev) => {
      if (prev === idx) return prev
      applyCarouselVisual(idx)
      return idx
    })
  }, [activeTab, applyCarouselVisual])
  const showMobileTabCarousel =
    isPoolMobile &&
    !isUpgradeView &&
    isPoolMobileSwipeTab(activeTab)
  const tabIndicatorStyle = {
    transform: `translate3d(${carouselIndex * 100}%, 0, 0)`,
    transitionDuration: reducedMotion ? '0ms' : `${POOL_TAB_CAROUSEL_MS}ms`,
    transitionProperty: 'transform',
    transitionTimingFunction: reducedMotion
      ? 'linear'
      : 'cubic-bezier(0, 0, 0.2, 1)',
  } as const

  // TEMPORARY — mock standings for design preview; flip USE_MOCK_LEADERBOARD off to restore.
  const leaderboardMembers = USE_MOCK_LEADERBOARD
    ? buildMockLeaderboardMembers(currentUserId)
    : members
  const leaderboardTabLoading = USE_MOCK_LEADERBOARD
    ? false
    : leaderboardLoading

  const isWinnerPool = pool.scoringStyle === 'winner'
  const isLegacyWinnerPool =
    isWinnerPool && (pool.legacyWinnerOnly ?? false)
  const hasResults =
    pool.matchesPlayed > 0 ||
    (isLegacyWinnerPool && members.some((member) => member.points > 0))
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
    if (tab === 'upgrade' || searchParams.get('upgrade') === '1') {
      // Mobile only: upgrade=1 / tab=upgrade opens the sheet over settings.
      // Desktop must use the /upgrade route — bounce if this query lands at lg+.
      if (shouldUsePoolSettingsMobileTab()) {
        setIsUpgradeView(true)
        setActiveTab('settings')
        return
      }
      setIsUpgradeView(false)
      router.replace(poolUpgradePath(pool.inviteCode))
      return
    }
    if (tab === 'settings') {
      setActiveTab('settings')
      setIsUpgradeView(false)
      if (!shouldUsePoolSettingsMobileTab()) {
        shallowPoolSettingsUrl(
          poolSettingsPath(pool.inviteCode, 'details'),
          'replace',
        )
      }
      return
    }
    if (tab === 'home') {
      setActiveTab('home')
      setIsUpgradeView(false)
      if (!shouldUsePoolSettingsMobileTab()) {
        shallowPoolSettingsUrl(poolHomePath(pool.inviteCode), 'replace')
      }
      return
    }
    if (tab === 'leaderboard' || tab === 'predictions') {
      setActiveTab(normalizeTab(tab))
    }
  }, [searchParams, showChatTab, pool.inviteCode, router])

  /** If viewport crosses to desktop while the sheet is open, close it and go to the page. */
  useEffect(() => {
    if (isPoolMobile || !isUpgradeView) return
    setIsUpgradeView(false)
    router.replace(poolUpgradePath(pool.inviteCode))
  }, [isPoolMobile, isUpgradeView, pool.inviteCode, router])

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    toast.success(
      'Custom Pool unlocked — logo, colors, and commissioner tools are ready.',
    )
    setIsUpgradeView(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('upgraded')
    const qs = params.toString()
    shallowPoolSettingsUrl(
      qs
        ? `${poolPagePath(pool.inviteCode)}?${qs}`
        : poolPagePath(pool.inviteCode),
      'replace',
    )
  }, [searchParams, pool.inviteCode])

  useEffect(() => {
    if (shouldUsePoolSettingsMobileTab()) return
    if (parsePoolUpgradeFromPath(window.location.pathname)) {
      setIsUpgradeView(true)
      return
    }
    if (parsePoolHomeFromPath(window.location.pathname)) {
      setActiveTab('home')
      setIsUpgradeView(false)
    }
  }, [])

  useEffect(() => {
    if (shouldUsePoolSettingsMobileTab()) return
    const onPopState = () => {
      if (parsePoolUpgradeFromPath(window.location.pathname)) {
        setIsUpgradeView(true)
        return
      }
      setIsUpgradeView(false)
      if (parsePoolHomeFromPath(window.location.pathname)) {
        setActiveTab('home')
        return
      }
      const route = readPoolSettingsClientRoute()
      if (route.section && window.location.pathname.includes('/settings/')) {
        setActiveTab('settings')
        return
      }
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (
        tab === 'home' ||
        tab === 'leaderboard' ||
        tab === 'predictions' ||
        tab === 'settings'
      ) {
        setActiveTab(normalizeTab(tab))
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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

  const isWinnerPredictionsTab = isLegacyWinnerPool && activeTab === 'predictions'
  const isClassicPredictionsTab =
    (!isWinnerPool || !isLegacyWinnerPool) && activeTab === 'predictions'
  const isHomeTab = activeTab === 'home'
  const isLeaderboardTab = activeTab === 'leaderboard'
  const isPredictionsTab = activeTab === 'predictions'
  const isSettingsTab = activeTab === 'settings'
  /** Desktop shell (sidebar + shared top bar) — home, predictions, leaderboard, settings, upgrade; lg+ only. */
  const usePoolDesktopShell =
    !isChatView &&
    (isHomeTab ||
      isLeaderboardTab ||
      isPredictionsTab ||
      isSettingsTab ||
      isUpgradeView)

  /** Creator display name from profiles / members; skip null/empty user_ids. */
  const creatorDisplayName = (() => {
    if (!poolCreatorUserId) return null
    const fromProfile = memberProfilesByUserId
      ?.get(poolCreatorUserId)
      ?.displayName?.trim()
    if (fromProfile) return fromProfile
    const fromMember = members.find(
      (member) =>
        Boolean(member.userId) && member.userId === poolCreatorUserId,
    )?.name?.trim()
    return fromMember || null
  })()
  const canInvite = pool.acceptingMembers

  /** Stable pane trees — deferred setActiveTab must not rebuild Predictions (30k+ nodes). */
  const mobileCarouselPanes = useMemo(
    () => [
      <PoolHomeShell
        key="home"
        pool={pool}
        members={leaderboardMembers}
        userPredictions={userPredictions}
        currentUserId={currentUserId}
        poolId={poolId}
        memberId={memberId}
        leaderboardLoading={leaderboardTabLoading}
        leaderboardError={leaderboardError}
        onRetryLeaderboard={onRetryLeaderboard}
        onPredictionSaved={onPredictionSaved}
        onPredictionRemoved={onPredictionRemoved}
        onGoToPredictions={() => goToSwipeTab('predictions')}
        onGoToLeaderboard={() => goToSwipeTab('leaderboard')}
        onInvite={copyInviteLink}
      />,
      <div
        key="predictions"
        className={cn(
          isLegacyWinnerPool && 'overflow-x-visible',
          (!isWinnerPool || !isLegacyWinnerPool) && 'overflow-x-hidden',
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
          legacyWinnerOnly={pool.legacyWinnerOnly ?? false}
          eventSport={pool.eventSport ?? null}
          userRank={
            members.find(
              (member) =>
                member.isYou || member.userId === currentUserId,
            )?.rank ?? null
          }
          acceptingMembers={pool.acceptingMembers}
          hideDesktopOverviewSidebar
          winnerPool={
            isLegacyWinnerPool && poolId
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
      </div>,
      leaderboardTabLoading ? (
        <div key="leaderboard" className="mx-auto max-w-4xl">
          <LeaderboardSkeleton />
        </div>
      ) : (
        <div key="leaderboard" className="flex min-h-0 flex-1 flex-col">
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
      ),
    ],
    [
      pool,
      leaderboardMembers,
      userPredictions,
      currentUserId,
      poolId,
      memberId,
      leaderboardTabLoading,
      leaderboardError,
      onRetryLeaderboard,
      onPredictionSaved,
      onPredictionRemoved,
      goToSwipeTab,
      isLegacyWinnerPool,
      isWinnerPool,
      members,
      copied,
      showPreMatchLeaderboardNote,
    ],
  )

  const handleBackClick = () => {
    if (isPoolMobile && activeTab === 'settings') {
      const restore =
        tabBeforeSettings === 'settings' ? 'predictions' : tabBeforeSettings
      setActiveTab(restore)
      const params = new URLSearchParams(window.location.search)
      if (restore === 'home') {
        params.delete('tab')
      } else {
        params.set('tab', restore)
      }
      params.delete('section')
      params.delete('upgrade')
      const qs = params.toString()
      shallowPoolSettingsUrl(
        qs
          ? `${poolPagePath(pool.inviteCode)}?${qs}`
          : poolPagePath(pool.inviteCode),
        'replace',
      )
      return
    }
    console.log('back clicked', DASHBOARD_TAB_HREFS.dashboard)
    router.push(isChatView ? CHAT_INBOX_HREF : DASHBOARD_TAB_HREFS.dashboard)
  }

  return (
    <PoolThemeScope
      themeColor={pool.themeColor}
      className={cn(
        'min-h-screen',
        POOL_DESKTOP_CANVAS_CLASS,
        usePoolDesktopShell && 'flex flex-col',
        isMobileChatShell &&
          'max-sm:flex max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
      )}
    >
      <div
        className={cn(
          'relative',
          usePoolDesktopShell && 'flex min-h-0 flex-1 flex-col',
          isMobileChatShell &&
            'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-[100] isolate border-b',
            isChatView
              ? cn('border-white/[0.08]', POOL_DESKTOP_CANVAS_CLASS)
              : cn('border-border backdrop-blur-xl', POOL_DESKTOP_CHROME_SURFACE_CLASS),
            usePoolDesktopShell && 'shrink-0',
            // Desktop shell: top bar moves into the main column — hide this on lg+.
            usePoolDesktopShell && 'lg:hidden',
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
              isChatView
                ? 'py-2.5 sm:py-3'
                : 'py-4 max-sm:py-2.5',
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
                  <div className="flex shrink-0 items-center gap-3">
                    <ReportIssueButton />
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
                  </div>
                </>
              ) : (
                <>
                  <div className="flex w-full min-w-0 flex-col gap-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-4 max-lg:gap-2">
                        <button
                          type="button"
                          onClick={handleBackClick}
                          className="group relative z-[51] shrink-0 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-sm:p-1.5"
                          aria-label={
                            isPoolMobile && activeTab === 'settings'
                              ? 'Back to pool'
                              : 'Back to dashboard'
                          }
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
                          {/* Desktop sticky title (non-leaderboard shell). */}
                          <div className="hidden lg:block">
                            <div className="flex flex-wrap items-center gap-2">
                              <h1 className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                                {pool.name}
                              </h1>
                              <ScoringModeBadge scoringStyle={pool.scoringStyle} />
                            </div>
                          </div>
                          {/* Mobile header identity */}
                          <div className="lg:hidden">
                            <h1 className="w-full min-w-0 max-w-none truncate font-display text-lg tracking-wide text-foreground">
                              {pool.name}
                            </h1>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                              <ScoringModeBadge
                                scoringStyle={pool.scoringStyle}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Mobile overflow — DropdownMenu (app convention). */}
                      <div className="flex shrink-0 items-center lg:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                                FOCUS_VISIBLE_RING,
                              )}
                              aria-label="Pool options"
                            >
                              <MoreVertical className="h-5 w-5" aria-hidden />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            side="bottom"
                            sideOffset={8}
                            alignOffset={0}
                            className={POOL_OVERFLOW_MENU_CONTENT_CLASS}
                          >
                            {/*
                              Caret: 45° square sharing #171717 fill + #292929
                              top/left borders; sits under the ⋮ (align=end → right).
                            */}
                            <span
                              className="pointer-events-none absolute -top-1.5 right-3 z-10 h-3 w-3 rotate-45 border-l border-t border-[#292929] bg-[#171717]"
                              aria-hidden
                            />
                            <DropdownMenuItem
                              className={POOL_OVERFLOW_MENU_ITEM_CLASS}
                              onSelect={() => openSettingsFromNav()}
                            >
                              <Settings aria-hidden />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={POOL_OVERFLOW_MENU_ITEM_CLASS}
                              disabled={!pool.acceptingMembers}
                              onSelect={() => copyInviteLink()}
                            >
                              <UserPlus aria-hidden />
                              Invite members
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={POOL_OVERFLOW_MENU_ITEM_CLASS}
                              disabled={!pool.acceptingMembers}
                              onSelect={() => copyInviteLink()}
                            >
                              <Share2 aria-hidden />
                              Share pool
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={POOL_OVERFLOW_MENU_ITEM_CLASS}
                              onSelect={() => openReportIssue()}
                            >
                              <Flag aria-hidden />
                              Report issue
                            </DropdownMenuItem>
                            {poolId ? (
                              <DropdownMenuItem
                                variant="destructive"
                                className={POOL_OVERFLOW_MENU_ITEM_DESTRUCTIVE_CLASS}
                                onSelect={(event) => {
                                  event.preventDefault()
                                  setLeavePoolOpen(true)
                                }}
                              >
                                <LogOut aria-hidden />
                                Leave pool
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {/* Desktop sticky actions — legacy (non-leaderboard shell). */}
                      <div className="hidden shrink-0 items-center gap-3 lg:flex">
                        <ReportIssueButton />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openSettingsFromNav()}
                          aria-label="Pool settings"
                          className={cn(
                            'gap-1.5 font-display tracking-wide',
                            FOCUS_VISIBLE_RING,
                          )}
                        >
                          <Settings className="h-4 w-4" aria-hidden />
                          Settings
                        </Button>
                        <PoolShareButton
                          acceptingMembers={pool.acceptingMembers}
                          copied={copied}
                          onClick={copyInviteLink}
                        />
                      </div>
                    </div>
                    {/* Mobile tab row — text-only Home · Predictions · Leaderboard. */}
                    <div
                      className="mt-2 lg:hidden"
                      role="tablist"
                      aria-label="Pool sections"
                    >
                      <div className={POOL_MOBILE_TAB_LIST_CLASS}>
                        {(
                          [
                            { value: 'home', label: 'Home' },
                            { value: 'predictions', label: 'Predictions' },
                            { value: 'leaderboard', label: 'Leaderboard' },
                          ] as const
                        ).map(({ value, label }) => {
                          const isActive = activeTab === value
                          return (
                            <button
                              key={value}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              data-state={isActive ? 'active' : 'inactive'}
                              className={POOL_MOBILE_TAB_TRIGGER_CLASS}
                              onClick={() => goToSwipeTab(value)}
                            >
                              {label}
                            </button>
                          )
                        })}
                        <span
                          ref={tabIndicatorRef}
                          aria-hidden
                          className={cn(
                            POOL_MOBILE_TAB_INDICATOR_CLASS,
                            !isPoolMobileSwipeTab(activeTab) && 'opacity-0',
                          )}
                          style={tabIndicatorStyle}
                        />
                      </div>
                      {isLeaderboardTab && USE_MOCK_LEADERBOARD ? (
                        <span className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                          Mock preview
                        </span>
                      ) : null}
                      {isLeaderboardTab &&
                      !USE_MOCK_LEADERBOARD &&
                      leaderboardRefreshing ? (
                        <span
                          className="mt-2 block animate-pulse text-[11px] font-medium tracking-wide text-muted-foreground"
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
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-primary"
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
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main
          ref={swipeRootRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          className={cn(
            'relative z-0 mx-auto w-full min-w-0 py-8',
            // Own the top inset for all non-chat pool content (banners + tabs)
            // so first child never hugs the sticky header. Matches mb-4 rhythm.
            'max-sm:pt-4',
            // Pool shell tabs: full-bleed main on desktop; mobile content pad on home/predictions.
            usePoolDesktopShell
              ? cn(
                  'flex max-w-none flex-1 flex-col px-0',
                  POOL_DESKTOP_CANVAS_CLASS,
                  'lg:min-h-screen lg:py-0 lg:pb-0',
                )
              : isClassicPredictionsTab
                ? cn('max-w-[82rem] px-4', POOL_DESKTOP_CANVAS_CLASS)
                : cn('max-w-4xl px-4', POOL_DESKTOP_CANVAS_CLASS),
            // Bottom nav persists on pool pages — must win over generic pb utilities.
            !isChatView
              ? MOBILE_BOTTOM_NAV_PAD_CLASS
              : 'max-sm:pb-8',
            isMobileChatShell &&
              'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden max-sm:px-0 max-sm:py-0 max-sm:pb-0',
          )}
        >
          {!isChatView && activeAnnouncement ? (
            <div
              className={cn(
                'mb-4',
                isLeaderboardTab && 'mx-auto max-w-4xl px-4',
                // Desktop shell: announcement lives in the main column (below).
                usePoolDesktopShell && 'lg:hidden',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4 max-sm:pt-3',
              )}
            >
              <PoolAnnouncementBanner
                announcement={activeAnnouncement}
                onDismissed={(id) => onAnnouncementDismissed?.(id)}
              />
            </div>
          ) : null}

          {!isChatView && poolId && isHomeTab ? (
            <div
              className={cn(
                'mb-4 lg:hidden',
                POOL_MOBILE_CONTENT_PAD_CLASS,
                isMobileChatShell && 'max-sm:shrink-0',
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
              setIsUpgradeView(false)
              if (value === 'settings') {
                setActiveTab('settings')
                syncDesktopPoolTabUrl('settings')
                return
              }
              setActiveTab(value)
              syncDesktopPoolTabUrl(value)
            }}
            className={cn(
              'mb-8 w-full min-w-0 gap-6',
              'lg:flex lg:flex-row lg:items-start lg:gap-4',
              usePoolDesktopShell &&
                'mb-0 flex min-h-0 flex-1 flex-col gap-4 lg:min-h-screen lg:flex-row lg:items-stretch lg:gap-0',
              isMobileChatShell &&
                'max-sm:mb-0 max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
              isMobileChatShell && isChatView && 'max-sm:gap-0',
            )}
          >
            {!isChatView && usePoolDesktopShell ? (
              <PoolDesktopSidebar
                pool={pool}
                creatorName={creatorDisplayName}
                canInvite={canInvite}
                onInvite={copyInviteLink}
                members={leaderboardMembers}
                poolId={poolId}
                inviteCode={pool.inviteCode}
                poolHasCommissionerTools={poolHasCommissionerTools}
                onNavigateUpgrade={openPoolUpgrade}
              />
            ) : null}

            {!isChatView && !usePoolDesktopShell ? (
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
                  </TabsList>
                </div>
              </nav>
            ) : null}

            <div
              className={cn(
                'min-w-0 flex-1 shrink lg:min-h-0',
                usePoolDesktopShell
                  ? 'basis-0 lg:flex lg:min-h-screen lg:flex-col'
                  : 'basis-[70rem]',
              )}
            >
            {usePoolDesktopShell && !isUpgradeView ? (
              <PoolDesktopTopBar
                context={
                  isSettingsTab && !isUpgradeView ? 'settings' : 'pool'
                }
                poolName={pool.name}
                scoringStyle={pool.scoringStyle}
                memberCount={pool.memberCount}
                isPublic={pool.isPublic}
                avatar={pool.avatar}
                emblemUrl={pool.emblemUrl}
                canInvite={canInvite}
                onInvite={copyInviteLink}
              />
            ) : null}
            {usePoolDesktopShell && isUpgradeView ? (
              <PoolUpgradeDesktopView
                inviteCode={pool.inviteCode}
                poolId={poolId}
                poolName={pool.name}
                isOwner={Boolean(isPoolOwner)}
                poolHasCommissionerTools={poolHasCommissionerTools}
                onBackToSettings={closePoolUpgrade}
                className="hidden min-h-0 flex-1 lg:flex"
              />
            ) : null}
            {usePoolDesktopShell && !isChatView && activeAnnouncement && !isUpgradeView ? (
              <div className="mb-4 hidden px-4 pt-4 lg:block lg:px-6 xl:px-8">
                <PoolAnnouncementBanner
                  announcement={activeAnnouncement}
                  onDismissed={(id) => onAnnouncementDismissed?.(id)}
                />
              </div>
            ) : null}
            {usePoolDesktopShell && isLeaderboardTab && !isUpgradeView ? (
              <div className="mx-auto hidden w-full px-6 pt-2 xl:px-8 lg:block">
                {USE_MOCK_LEADERBOARD ? (
                  <span className="mb-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                    Mock preview
                  </span>
                ) : null}
                {!USE_MOCK_LEADERBOARD && leaderboardRefreshing ? (
                  <span
                    className="mb-3 block animate-pulse text-[11px] font-medium tracking-wide text-muted-foreground"
                    aria-live="polite"
                  >
                    Updating…
                  </span>
                ) : null}
                {!USE_MOCK_LEADERBOARD &&
                !leaderboardRefreshing &&
                leaderboardLiveSync ? (
                  <span
                    className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-primary"
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
            <div
              className={cn(
                usePoolDesktopShell && isUpgradeView && 'lg:hidden',
              )}
            >
            {/*
              Mobile: one horizontal track (tap + swipe → activeTab → carouselIndex).
              Desktop: existing TabsContent panels (forceMount) — untouched.
              Settings/chat stay as TabsContent on both; carousel hides (stays mounted)
              while those views are active so adjacent panes never remount blank.
            */}
            {isPoolMobile ? (
              <div
                className={cn(!showMobileTabCarousel && 'hidden')}
                aria-hidden={!showMobileTabCarousel}
              >
                <PoolMobileTabCarousel
                  ref={carouselRef}
                  activeIndex={carouselIndex}
                  reducedMotion={reducedMotion}
                >
                  {mobileCarouselPanes}
                </PoolMobileTabCarousel>
              </div>
            ) : (
              <>
            <TabsContent
              value="home"
              forceMount
              className={cn(
                'mt-0 w-full min-w-0',
                POOL_MOBILE_CONTENT_PAD_CLASS,
                usePoolDesktopShell &&
                  'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-0',
              )}
            >
              <PoolHomeShell
                className={cn(
                  usePoolDesktopShell && 'lg:flex-1',
                )}
                pool={pool}
                members={leaderboardMembers}
                userPredictions={userPredictions}
                currentUserId={currentUserId}
                poolId={poolId}
                memberId={memberId}
                leaderboardLoading={leaderboardTabLoading}
                leaderboardError={leaderboardError}
                onRetryLeaderboard={onRetryLeaderboard}
                onPredictionSaved={onPredictionSaved}
                onPredictionRemoved={onPredictionRemoved}
                onGoToPredictions={() => {
                  setActiveTab('predictions')
                  syncDesktopPoolTabUrl('predictions')
                }}
                onGoToLeaderboard={() => {
                  setActiveTab('leaderboard')
                  syncDesktopPoolTabUrl('leaderboard')
                }}
                onInvite={copyInviteLink}
              />
            </TabsContent>

            <TabsContent
              value="predictions"
              forceMount
              className={cn(
                'mt-0 w-full min-w-0',
                POOL_MOBILE_CONTENT_PAD_CLASS,
                isWinnerPredictionsTab && 'overflow-x-visible',
                isClassicPredictionsTab && 'overflow-x-hidden',
                // Desktop shell: same content rail as leaderboard (match cards reflow).
                usePoolDesktopShell &&
                  cn(
                    POOL_DESKTOP_CONTENT_RAIL_CLASS,
                    'lg:px-6 lg:pb-8 lg:pt-2 xl:px-8',
                  ),
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
                legacyWinnerOnly={pool.legacyWinnerOnly ?? false}
                eventSport={pool.eventSport ?? null}
                userRank={
                  members.find(
                    (member) =>
                      member.isYou || member.userId === currentUserId,
                  )?.rank ?? null
                }
                acceptingMembers={pool.acceptingMembers}
                /** Shell owns desktop chrome — hide overview column on lg+. */
                hideDesktopOverviewSidebar
                winnerPool={
                  isLegacyWinnerPool && poolId
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
              forceMount
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
              </>
            )}

            <TabsContent
              value="settings"
              className={cn(
                'mt-0 w-full min-w-0',
                POOL_MOBILE_CONTENT_PAD_CLASS,
                'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-0',
              )}
            >
              <div className="lg:hidden">
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
                    onNavigateUpgrade: openPoolUpgrade,
                  }}
                />
              </div>
              {usePoolDesktopShell ? (
                <div className="hidden min-h-0 min-w-0 flex-1 flex-col lg:flex">
                  <PoolSettingsDesktopShell
                  inviteCode={pool.inviteCode}
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
                    onNavigateUpgrade: openPoolUpgrade,
                  }}
                />
                </div>
              ) : null}
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
            </div>
          </Tabs>
          </PoolPredictionStatusFilterProvider>
        </main>
      </div>
      {isPoolMobile ? (
        <PoolUpgradeMobileSheet
          open={isUpgradeView && !poolHasCommissionerTools}
          onOpenChange={(open) => {
            if (open) {
              if (!isUpgradeView) openPoolUpgrade()
              return
            }
            closePoolUpgrade()
          }}
          inviteCode={pool.inviteCode}
          poolId={poolId}
          isOwner={Boolean(isPoolOwner)}
          poolHasCommissionerTools={poolHasCommissionerTools}
        />
      ) : null}
      {poolId && currentUserId ? (
        <LeavePoolDialog
          poolId={poolId}
          poolName={pool.name}
          currentUserId={currentUserId}
          isCreator={Boolean(isPoolOwner)}
          members={leaderboardMembers}
          open={leavePoolOpen}
          onOpenChange={setLeavePoolOpen}
          showTrigger={false}
          onOwnershipTransferred={onOwnershipTransferred}
        />
      ) : null}
    </PoolThemeScope>
  )
}
