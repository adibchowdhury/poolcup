'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  Pencil,
  Plus,
  Target,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardInsightCards } from '@/components/dashboard/dashboard-insight-cards'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { DashboardDesktopNav } from '@/components/dashboard/dashboard-desktop-nav'
import { DashboardFeed } from '@/components/dashboard/feed/dashboard-feed'
import { GlobalActivitySection } from '@/components/dashboard/feed/global-activity-section'
import { LiveNowSection } from '@/components/dashboard/feed/live-now-section'
import { RecentResultsSection } from '@/components/dashboard/feed/recent-results-section'
import { OfficialPoolsSection } from '@/components/dashboard/feed/official-pools-section'
import { YourPoolsSection } from '@/components/dashboard/feed/your-pools-section'
import { PointsHistoryFeed } from '@/components/dashboard/points-history-feed'
import { SportBubblesRow } from '@/components/dashboard/sport-bubbles-row'
import { EventPillsRow } from '@/components/dashboard/event-pills-row'
import { KnockoutBracketSetBanner } from '@/components/dashboard/knockout-bracket-set-banner'
import { ScoringUpdateNoticeBanner } from '@/components/dashboard/scoring-update-notice-banner'
import { SupportPromptDialog } from '@/components/dashboard/support-prompt-dialog'
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
  clearCurrentUserCustomAvatar,
  uploadCurrentUserAvatar,
} from '@/src/lib/upload-user-avatar'
import { UserAvatarImage } from '@/components/user-avatar-image'
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
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

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
  customAvatarUrl?: string | null
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
  customAvatarUrl: initialCustomAvatarUrl = null,
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
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(
    () => initialCustomAvatarUrl?.trim() || null,
  )
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingCustomAvatar, setRemovingCustomAvatar] = useState(false)
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setCustomAvatarUrl(initialCustomAvatarUrl?.trim() || null)
  }, [initialCustomAvatarUrl])

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
    if (avatarSaving || uploadingAvatar || removingCustomAvatar) return
    if (!customAvatarUrl && filename === selectedAvatar) return

    const previousPreset = selectedAvatar
    const previousCustom = customAvatarUrl
    setAvatarSaving(filename)
    setSelectedAvatar(filename)
    setCustomAvatarUrl(null)

    const { error } = await supabase
      .from('users')
      .update({ avatar: filename, custom_avatar_url: null })
      .eq('id', userId)

    setAvatarSaving(null)

    if (error) {
      setSelectedAvatar(previousPreset)
      setCustomAvatarUrl(previousCustom)
      setEditProfileMessage(error.message)
      console.error('Failed to save avatar:', error.message)
      return
    }

    setEditProfileMessage('Avatar updated.')
  }

  async function handleAvatarFileSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingAvatar || avatarSaving || removingCustomAvatar) return

    setUploadingAvatar(true)
    setEditProfileMessage(null)

    const { publicUrl, error } = await uploadCurrentUserAvatar(supabase, file)

    setUploadingAvatar(false)

    if (error || !publicUrl) {
      setEditProfileMessage(error ?? 'Upload failed')
      return
    }

    setCustomAvatarUrl(publicUrl)
    setEditProfileMessage('Photo uploaded.')
  }

  async function handleRemoveCustomAvatar() {
    if (!customAvatarUrl || removingCustomAvatar || uploadingAvatar) return

    const previousCustom = customAvatarUrl
    setRemovingCustomAvatar(true)
    setCustomAvatarUrl(null)
    setEditProfileMessage(null)

    const { error } = await clearCurrentUserCustomAvatar(supabase, userId)

    setRemovingCustomAvatar(false)

    if (error) {
      setCustomAvatarUrl(previousCustom)
      setEditProfileMessage(error)
      return
    }

    setEditProfileMessage('Custom photo removed.')
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

  const shownName = headerName.trim() || 'Player'

  const quickStatItems = [
    {
      label: 'Total Points',
      icon: Zap,
      value: liveTotalPoints,
      color: 'text-primary',
    },
    {
      label: 'Predictions Made',
      icon: Target,
      value: quickStats.predictionsMade,
      color: 'text-[#ffb300]',
    },
    {
      label: 'Win Rate',
      icon: TrendingUp,
      value: quickStats.winRate != null ? `${quickStats.winRate}%` : '—',
      color: 'text-primary',
    },
  ] as const

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={headerName}
      avatar={selectedAvatar}
      customAvatarUrl={customAvatarUrl}
    >
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-4">
        <KnockoutBracketSetBanner userId={userId} />
      </div>
      <ScoringUpdateNoticeBanner />

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
              <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
                <section className="flex flex-col items-center text-center">
                  <UserAvatarImage
                    avatar={selectedAvatar}
                    customAvatarUrl={customAvatarUrl}
                    className="h-48 w-48 border border-border"
                    imgClassName={
                      customAvatarUrl
                        ? 'object-cover'
                        : 'object-contain object-bottom p-2'
                    }
                  />
                  <h2 className="mt-4 font-display text-4xl tracking-wide text-foreground">
                    {shownName}
                  </h2>
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
                </section>

                <section className="grid grid-cols-3 gap-3">
                  {quickStatItems.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-border bg-card/50 px-3 py-4 text-center"
                    >
                      <stat.icon
                        className={cn('mx-auto h-5 w-5', stat.color)}
                        aria-hidden
                      />
                      <p className="mt-2 font-display text-2xl leading-none text-foreground">
                        {stat.label === 'Total Points' ? (
                          <AnimatedTotalPointsDisplay
                            key={pointsAnimKey}
                            target={liveTotalPoints}
                          />
                        ) : typeof stat.value === 'number' ? (
                          stat.value.toLocaleString()
                        ) : (
                          stat.value
                        )}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </section>

                <PointsHistoryFeed
                  userId={userId}
                  animKey={pointsAnimKey}
                  active={activeTab === 'profile'}
                  alwaysCollapsible
                />

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
                          Upload a photo or pick a preset character. Changes
                          save instantly.
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-3">
                        <UserAvatarImage
                          avatar={selectedAvatar}
                          customAvatarUrl={customAvatarUrl}
                          className="h-24 w-24 border border-border"
                          imgClassName={
                            customAvatarUrl
                              ? 'object-cover'
                              : 'object-contain object-bottom p-1'
                          }
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => void handleAvatarFileSelected(event)}
                        />
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={
                              uploadingAvatar ||
                              Boolean(avatarSaving) ||
                              removingCustomAvatar
                            }
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4" aria-hidden />
                            {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                          </Button>
                          {customAvatarUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={
                                removingCustomAvatar ||
                                uploadingAvatar ||
                                Boolean(avatarSaving)
                              }
                              onClick={() => void handleRemoveCustomAvatar()}
                            >
                              {removingCustomAvatar
                                ? 'Removing…'
                                : 'Remove custom'}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                        {availableAvatars.map((filename) => {
                          const isSelected =
                            !customAvatarUrl && selectedAvatar === filename
                          const isSaving = avatarSaving === filename
                          const avatarLabel = filename.replace(/\.[^.]+$/, '')

                          return (
                            <button
                              key={filename}
                              type="button"
                              onClick={() => void handleSelectAvatar(filename)}
                              disabled={
                                Boolean(avatarSaving) ||
                                uploadingAvatar ||
                                removingCustomAvatar
                              }
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
                              {isSaving ? (
                                <span className="sr-only">Saving…</span>
                              ) : null}
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
              </div>
            </TabsContent>

            <TabsContent
              value="pools"
              className="space-y-6 pb-8 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            >
              <SportBubblesRow className="-mt-6 mb-6 sm:-mt-8" />
              <EventPillsRow />

              <DashboardFeed>
                <LiveNowSection userId={userId} />
                <YourPoolsSection
                  userId={userId}
                  pools={dashboardPools}
                  loading={dashboardPoolsLoading}
                  error={dashboardPoolsError}
                  onPoolDeleted={handleDashboardPoolDeleted}
                />
                <OfficialPoolsSection
                  userId={userId}
                  email={email}
                  onJoined={() => void loadDashboardPools()}
                />
                <RecentResultsSection userId={userId} />
                <GlobalActivitySection userId={userId} />
              </DashboardFeed>

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
