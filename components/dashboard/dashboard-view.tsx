'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  Pencil,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ActivePoolsTab } from '@/components/dashboard/active-pools-tab'
import { DashboardInsightCards } from '@/components/dashboard/dashboard-insight-cards'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { DashboardDesktopNav } from '@/components/dashboard/dashboard-desktop-nav'
import { PointsHistoryFeed } from '@/components/dashboard/points-history-feed'
import { LiveScoreboard } from '@/components/dashboard/live-scoreboard'
import { WorldCupUrgencyBanner } from '@/components/dashboard/world-cup-urgency-banner'
import { ScoringUpdateNoticeBanner } from '@/components/dashboard/scoring-update-notice-banner'
import { RulesUpdateBanner } from '@/components/dashboard/rules-update-banner'
import { SupportPromptDialog } from '@/components/dashboard/support-prompt-dialog'
import { ThirdPlaceDeadlineBanner } from '@/components/dashboard/third-place-deadline-banner'
import { HowItWorksTab } from '@/components/dashboard/how-it-works-tab'
import {
  prefetchUpcomingMatches,
  UpcomingGamesTab,
} from '@/components/dashboard/upcoming-games-tab'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { cn } from '@/lib/utils'
import {
  getAvatarSrc,
  resolveAvatarFilename,
} from '@/src/lib/avatars'
import {
  getPlayerLevelFromPoints,
} from '@/src/lib/player-level'
import { supabase } from '@/src/lib/supabase'
import { useDashboardTab } from '@/src/lib/dashboard-tab-context'
import {
  DASHBOARD_NAV_ID_TO_TAB_VALUE,
  DASHBOARD_TAB_VALUE_TO_NAV_ID,
} from '@/src/lib/mobile-bottom-nav-routes'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAnimatedNumber } from '@/hooks/use-animated-number'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'

export type DashboardQuickStats = {
  totalPoints: number
  predictionsMade: number
  winRate: number | null
}

interface DashboardViewProps {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  supportPromptLastShownAt?: string | null
  quickStats: DashboardQuickStats
  passwordResetSuccess?: boolean
  errorMessage?: string | null
}

const DEFAULT_DASHBOARD_TAB = 'pools'

const DASHBOARD_TAB_PARAM_TO_VALUE: Record<string, string> = {
  profile: 'profile',
  pools: 'pools',
  upcoming: 'games',
  'how-it-works': 'how-it-works',
}

const DASHBOARD_TAB_VALUE_TO_PARAM: Record<string, string> = {
  profile: 'profile',
  pools: 'pools',
  games: 'upcoming',
  'how-it-works': 'how-it-works',
}

function dashboardTabFromParam(tabParam: string | null): string {
  if (!tabParam) return DEFAULT_DASHBOARD_TAB
  return DASHBOARD_TAB_PARAM_TO_VALUE[tabParam] ?? DEFAULT_DASHBOARD_TAB
}

function AnimatedTotalPointsDisplay({ target }: { target: number }) {
  const displayed = useAnimatedNumber(target)
  return <>{displayed.toLocaleString()}</>
}

function DashboardViewContent({
  userId,
  email,
  displayName,
  avatar,
  supportPromptLastShownAt = null,
  quickStats,
  passwordResetSuccess,
  errorMessage,
}: DashboardViewProps) {
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [fullName, setFullName] = useState(displayName ?? '')
  const [headerName, setHeaderName] = useState(displayName ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [editProfileMessage, setEditProfileMessage] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    resolveAvatarFilename(avatar),
  )
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null)
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])

  const [liveTotalPoints, setLiveTotalPoints] = useState(quickStats.totalPoints)
  const [pointsAnimKey, setPointsAnimKey] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { registerDashboardNavHandler, setActiveNavId } = useDashboardTab()
  const [activeTab, setActiveTab] = useState(() =>
    dashboardTabFromParam(searchParams.get('tab')),
  )
  const [dashboardPools, setDashboardPools] = useState<DashboardPoolCardData[]>(
    [],
  )
  const [dashboardPoolsLoading, setDashboardPoolsLoading] = useState(true)
  const [dashboardPoolsError, setDashboardPoolsError] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setActiveTab(dashboardTabFromParam(searchParams.get('tab')))
  }, [searchParams])

  useEffect(() => {
    const navId = DASHBOARD_TAB_VALUE_TO_NAV_ID[activeTab]
    if (navId) {
      setActiveNavId(navId)
    }
  }, [activeTab, setActiveNavId])

  const refreshUserPoints = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to refresh user points:', error.message)
      return
    }

    if (typeof data?.points === 'number') {
      setLiveTotalPoints(data.points)
    }
  }, [userId])

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value)

      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', DASHBOARD_TAB_VALUE_TO_PARAM[value] ?? DEFAULT_DASHBOARD_TAB)
      router.replace(`/dashboard?${params.toString()}`, { scroll: false })

      if (value === 'profile') {
        setPointsAnimKey((k) => k + 1)
        void refreshUserPoints()
      }
    },
    [router, searchParams, refreshUserPoints],
  )

  useEffect(() => {
    registerDashboardNavHandler((navId) => {
      handleTabChange(DASHBOARD_NAV_ID_TO_TAB_VALUE[navId])
    })
    return () => {
      registerDashboardNavHandler(null)
      setActiveNavId(null)
    }
  }, [handleTabChange, registerDashboardNavHandler, setActiveNavId])

  useEffect(() => {
    async function loadAvatars() {
      try {
        const response = await fetch('/api/avatars')
        if (!response.ok) {
          throw new Error('Failed to load avatars')
        }
        const images = (await response.json()) as string[]
        setAvailableAvatars(images)
      } catch (error) {
        console.error('Failed to load avatars:', error)
      }
    }

    void loadAvatars()
  }, [])

  useEffect(() => {
    setSelectedAvatar(resolveAvatarFilename(avatar))
  }, [avatar])

  useEffect(() => {
    const name = displayName ?? ''
    setFullName(name)
    setHeaderName(name)
  }, [displayName])

  useEffect(() => {
    setLiveTotalPoints(quickStats.totalPoints)
  }, [quickStats.totalPoints])

  useEffect(() => {
    void refreshUserPoints()
  }, [refreshUserPoints])

  useEffect(() => {
    const channel = supabase
      .channel(`user-points-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { points?: number }
          if (typeof row.points === 'number') {
            setLiveTotalPoints(row.points)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshUserPoints()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refreshUserPoints])

  useEffect(() => {
    function refreshIfProfileVisible() {
      if (document.visibilityState === 'visible' && activeTab === 'profile') {
        void refreshUserPoints()
      }
    }

    window.addEventListener('focus', refreshIfProfileVisible)
    document.addEventListener('visibilitychange', refreshIfProfileVisible)

    return () => {
      window.removeEventListener('focus', refreshIfProfileVisible)
      document.removeEventListener('visibilitychange', refreshIfProfileVisible)
    }
  }, [activeTab, refreshUserPoints])

  useEffect(() => {
    void prefetchUpcomingMatches()
  }, [])

  const loadDashboardPools = useCallback(async () => {
    setDashboardPoolsLoading(true)
    setDashboardPoolsError(null)

    const { pools, error: fetchError } = await fetchDashboardPools(
      supabase,
      userId,
    )

    setDashboardPools(pools)
    setDashboardPoolsError(fetchError)
    setDashboardPoolsLoading(false)
  }, [userId])

  useEffect(() => {
    void loadDashboardPools()
  }, [loadDashboardPools])

  function handleDashboardPoolDeleted(poolId: string) {
    setDashboardPools((previous) => previous.filter((pool) => pool.id !== poolId))
  }

  const canSaveDisplayName = useMemo(() => {
    return Boolean(fullName.trim())
  }, [fullName])

  async function handleSelectAvatar(filename: string) {
    if (filename === selectedAvatar || avatarSaving) return

    setAvatarSaving(filename)
    setSelectedAvatar(filename)

    const { error } = await supabase
      .from('users')
      .update({ avatar: filename })
      .eq('id', userId)

    setAvatarSaving(null)

    if (error) {
      setSelectedAvatar(resolveAvatarFilename(avatar))
      console.error('Failed to save avatar:', error.message)
    }
  }

  async function handleSaveDisplayName() {
    setProfileSaving(true)
    setEditProfileMessage(null)
    try {
      if (fullName.trim()) {
        const trimmed = fullName.trim()
        const { error } = await supabase
          .from('users')
          .update({ display_name: trimmed })
          .eq('id', userId)
        if (error) throw error
        setHeaderName(trimmed)
      }

      setEditProfileMessage('Saved.')
    } catch (e: any) {
      setEditProfileMessage(e?.message ?? 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  function openEditProfile() {
    setFullName(headerName)
    setEditProfileMessage(null)
    setEditProfileOpen(true)
  }

  const playerLevel = useMemo(
    () => getPlayerLevelFromPoints(liveTotalPoints),
    [liveTotalPoints],
  )

  const quickStatItems = [
    {
      label: 'Total Points',
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
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={headerName}
      avatar={selectedAvatar}
    >
      <ScoringUpdateNoticeBanner />
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-4">
        <ThirdPlaceDeadlineBanner userId={userId} />
        <RulesUpdateBanner userId={userId} />
      </div>

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

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="gap-10"
          >
            <DashboardDesktopNav />

            <TabsContent value="profile" className="mt-4">
              <div className="flex w-full items-center justify-center">
                <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-12 lg:flex-row lg:items-center">
                  <PointsHistoryFeed
                    userId={userId}
                    animKey={pointsAnimKey}
                    active={activeTab === 'profile'}
                    mobileCollapsible
                    className="order-2 lg:order-1"
                  />
                  <div className="order-1 mx-auto flex flex-col items-center gap-12 lg:order-2 lg:flex-row">
                  <div className="flex flex-col items-center gap-3 text-center sm:gap-4 lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[1fr_auto] lg:gap-4">
                    <div className="flex min-h-[320px] w-full max-w-[380px] items-end justify-center sm:max-w-[480px] lg:h-full lg:min-h-0 lg:w-full lg:max-w-[min(100%,580px)]">
                      <Image
                        src={getAvatarSrc(selectedAvatar)}
                        alt={`${playerLevel.title} — Level ${playerLevel.level}`}
                        width={580}
                        height={800}
                        priority
                        className="h-[320px] w-auto max-w-full object-contain object-bottom sm:h-[400px] lg:h-full"
                        sizes="(max-width: 1024px) 420px, 580px"
                      />
                    </div>

                    <div className="shrink-0 text-center">
                      <p className="font-display text-5xl tracking-wide text-foreground sm:text-6xl">
                        {playerLevel.title}
                      </p>
                      <p className="mt-1 text-lg text-muted-foreground sm:text-xl">
                        Level {playerLevel.level}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                        onClick={openEditProfile}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit profile
                      </Button>
                    </div>
                  </div>

                  <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit profile</DialogTitle>
                        <DialogDescription>
                          Update how you appear in pools and on your profile.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="edit-profile-full-name">Display name</Label>
                          <Input
                            id="edit-profile-full-name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                          />
                        </div>

                        <div className="space-y-2">
                          <h3 className="font-display text-xl tracking-wide">
                            Choose Your Avatar
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Pick a character for your profile. Changes save instantly.
                          </p>
                        </div>

                        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                          {availableAvatars.map((filename) => {
                            const isSelected = selectedAvatar === filename
                            const isSaving = avatarSaving === filename
                            const avatarLabel = filename.replace(/\.[^.]+$/, '')

                            return (
                              <button
                                key={filename}
                                type="button"
                                onClick={() => void handleSelectAvatar(filename)}
                                disabled={Boolean(avatarSaving)}
                                aria-pressed={isSelected}
                                aria-label={`Select ${avatarLabel} avatar`}
                                className={cn(
                                  'rounded-lg border-2 bg-muted/20 p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                  isSelected
                                    ? 'border-primary ring-2 ring-primary/40'
                                    : 'border-border hover:border-muted-foreground/50',
                                )}
                              >
                                <Image
                                  src={getAvatarSrc(filename)}
                                  alt=""
                                  width={80}
                                  height={80}
                                  className="mx-auto h-20 w-20 object-contain"
                                />
                                {isSaving && (
                                  <span className="sr-only">Saving…</span>
                                )}
                              </button>
                            )
                          })}
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          {editProfileMessage ? (
                            <p className="text-sm text-muted-foreground">
                              {editProfileMessage}
                            </p>
                          ) : (
                            <span />
                          )}
                          <Button
                            type="button"
                            onClick={handleSaveDisplayName}
                            disabled={profileSaving || !canSaveDisplayName}
                          >
                            {profileSaving ? 'Saving…' : 'Save name'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="flex h-full min-h-0 flex-col items-start justify-center gap-12 py-4 sm:gap-14 lg:min-h-0 lg:gap-16 lg:py-0 lg:pl-4">
                    {quickStatItems.map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-6 sm:gap-7"
                      >
                        <stat.icon
                          className={cn('h-12 w-12 shrink-0 sm:h-14 sm:w-14', stat.color)}
                          aria-hidden
                        />
                        <div className="text-left">
                          <div className="font-display text-6xl leading-none text-foreground sm:text-7xl lg:text-8xl">
                            {stat.label === 'Total Points' ? (
                              <AnimatedTotalPointsDisplay
                                key={pointsAnimKey}
                                target={liveTotalPoints}
                              />
                            ) : (
                              stat.value
                            )}
                          </div>
                          <div className="mt-2 text-lg text-muted-foreground sm:text-xl">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="pools"
              className="space-y-6 pb-8 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            >
              <div className="-mt-4">
                <WorldCupUrgencyBanner />
              </div>
              <LiveScoreboard />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Sparkles className="h-5 w-5 shrink-0 text-[#ffb300]" />
                  <h2 className="font-display text-2xl tracking-wide text-foreground">
                    Your Active Pools
                  </h2>
                </div>
                <Button
                  asChild
                  className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 group"
                >
                  <Link href="/create">
                    <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                    Create a Pool
                  </Link>
                </Button>
              </div>

              <ActivePoolsTab
                userId={userId}
                pools={dashboardPools}
                loading={dashboardPoolsLoading}
                error={dashboardPoolsError}
                onPoolDeleted={handleDashboardPoolDeleted}
              />
              <DashboardInsightCards pools={dashboardPools} />
            </TabsContent>

            <TabsContent value="games" className="mt-2">
              <UpcomingGamesTab />
            </TabsContent>

            <TabsContent value="how-it-works" className="mt-4">
              <HowItWorksTab currentPoints={liveTotalPoints} />
            </TabsContent>
          </Tabs>

      <SupportPromptDialog
        userId={userId}
        supportPromptLastShownAt={supportPromptLastShownAt}
        predictionsMade={quickStats.predictionsMade}
      />
    </DashboardAppShell>
  )
}

export function DashboardView(props: DashboardViewProps) {
  return (
    <Suspense fallback={null}>
      <DashboardViewContent {...props} />
    </Suspense>
  )
}
