'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  BookOpen,
  Calendar,
  Heart,
  Mail,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDashboardSignOut } from '@/components/dashboard-sign-out'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { STRIPE_DONATE_URL } from '@/components/support-us-button'
import { ActivePoolsTab } from '@/components/dashboard/active-pools-tab'
import { DashboardMobileNavMenu } from '@/components/dashboard/dashboard-mobile-nav-menu'
import { ReportIssueButton } from '@/components/report-issue-dialog'
import { DeleteAccountSection } from '@/components/dashboard/delete-account-section'
import { PointsHistoryFeed } from '@/components/dashboard/points-history-feed'
import { LiveScoreboard } from '@/components/dashboard/live-scoreboard'
import { WorldCupUrgencyBanner } from '@/components/dashboard/world-cup-urgency-banner'
import { ScoringUpdateNoticeBanner } from '@/components/dashboard/scoring-update-notice-banner'
import { HowItWorksTab } from '@/components/dashboard/how-it-works-tab'
import {
  prefetchUpcomingMatches,
  UpcomingGamesTab,
} from '@/components/dashboard/upcoming-games-tab'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import {
  getAvatarSrc,
  resolveAvatarFilename,
} from '@/src/lib/avatars'
import {
  getPlayerLevelFromPoints,
} from '@/src/lib/player-level'
import { supabase } from '@/src/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

function getAvatarInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed.charAt(0).toUpperCase() || '?'
}

function DashboardViewContent({
  userId,
  email,
  displayName,
  avatar,
  quickStats,
  passwordResetSuccess,
  errorMessage,
}: DashboardViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [fullName, setFullName] = useState(displayName ?? '')
  const [headerName, setHeaderName] = useState(displayName ?? '')
  const [newEmail, setNewEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [editProfileMessage, setEditProfileMessage] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    resolveAvatarFilename(avatar),
  )
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null)
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmNextPassword, setConfirmNextPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [liveTotalPoints, setLiveTotalPoints] = useState(quickStats.totalPoints)
  const [pointsAnimKey, setPointsAnimKey] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(() =>
    dashboardTabFromParam(searchParams.get('tab')),
  )
  const { handleSignOut, loading: signOutLoading } = useDashboardSignOut()

  useEffect(() => {
    setActiveTab(dashboardTabFromParam(searchParams.get('tab')))
  }, [searchParams])

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

  const canSaveDisplayName = useMemo(() => {
    return Boolean(fullName.trim())
  }, [fullName])

  const canSaveEmail = useMemo(() => {
    return Boolean(newEmail.trim())
  }, [newEmail])

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

  async function handleSaveEmail() {
    setAccountSaving(true)
    setAccountMessage(null)
    try {
      if (newEmail.trim()) {
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
        if (error) throw error
        setNewEmail('')
      }

      setAccountMessage('Saved. Some email changes may require confirmation.')
    } catch (e: any) {
      setAccountMessage(e?.message ?? 'Failed to update email')
    } finally {
      setAccountSaving(false)
    }
  }

  function openEditProfile() {
    setFullName(headerName)
    setEditProfileMessage(null)
    setEditProfileOpen(true)
  }

  async function handleUpdatePassword() {
    setPasswordSaving(true)
    setPasswordMessage(null)

    try {
      if (!currentPassword) {
        throw new Error('Current password is required')
      }
      if (!nextPassword || nextPassword.length < 6) {
        throw new Error('New password must be at least 6 characters')
      }
      if (nextPassword !== confirmNextPassword) {
        throw new Error('New passwords do not match')
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauthError) throw reauthError

      const { error: updateError } = await supabase.auth.updateUser({
        password: nextPassword,
      })
      if (updateError) throw updateError

      setCurrentPassword('')
      setNextPassword('')
      setConfirmNextPassword('')
      setPasswordMessage('Password updated.')
    } catch (e: any) {
      setPasswordMessage(e?.message ?? 'Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
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
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="z-50 md:sticky md:top-0">
          <header className="border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <PoolCupLogo href="/dashboard" />

              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
                <ReportIssueButton />

                <DashboardMobileNavMenu
                  className="sm:hidden"
                  displayName={headerName}
                  email={email}
                  onOpenSettings={() => setSettingsOpen(true)}
                />

                <div className="hidden shrink-0 sm:flex sm:items-center sm:gap-2">
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
                        {headerName.trim() || 'Account'}
                      </span>
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted ring-1 ring-border/80">
                        <Avatar className="size-full">
                          <AvatarImage
                            src={getAvatarSrc(selectedAvatar)}
                            alt=""
                            className="object-cover object-center"
                          />
                          <AvatarFallback className="bg-muted font-medium text-muted-foreground">
                            {getAvatarInitial(headerName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                      {email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href={STRIPE_DONATE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Heart className="h-4 w-4" />
                        Support Us
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/contact">
                        <Mail className="h-4 w-4" />
                        Contact
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={signOutLoading}
                      onSelect={(event) => {
                        event.preventDefault()
                        void handleSignOut()
                      }}
                    >
                      {signOutLoading ? 'Signing out…' : 'Sign out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </header>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
            <DialogHeader className="shrink-0">
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Manage your account, security, and preferences.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-display text-xl tracking-wide">
                  Account email
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your email is used to sign in.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Current email</Label>
                <div className="h-9 w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {email}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-new-email">New email (optional)</Label>
                <Input
                  id="settings-new-email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Your project may send a confirmation link before the update
                  takes effect.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {accountMessage ? (
                  <p className="text-sm text-muted-foreground">{accountMessage}</p>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  onClick={handleSaveEmail}
                  disabled={accountSaving || !canSaveEmail}
                >
                  {accountSaving ? 'Saving…' : 'Update email'}
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-display text-xl tracking-wide">
                  Password &amp; security
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confirm your current password before choosing a new one.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="settings-current-password">Current password</Label>
                  <Input
                    id="settings-current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-new-password">New password</Label>
                  <Input
                    id="settings-new-password"
                    value={nextPassword}
                    onChange={(e) => setNextPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-confirm-new-password">
                    Confirm new password
                  </Label>
                  <Input
                    id="settings-confirm-new-password"
                    value={confirmNextPassword}
                    onChange={(e) => setConfirmNextPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {passwordMessage ? (
                  <p className="text-sm text-muted-foreground">{passwordMessage}</p>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating…' : 'Update password'}
                </Button>
              </div>

              <Separator />

              <DeleteAccountSection userId={userId} avatar={avatar} />
            </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        <main className={cn('mx-auto max-w-6xl px-4 py-8', MOBILE_BOTTOM_NAV_PAD_CLASS)}>
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
            <TabsList className="mx-auto hidden h-auto w-full max-w-3xl grid-cols-2 gap-1 p-1 sm:grid sm:grid-cols-4">
              <TabsTrigger value="profile" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="pools" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="truncate">Active Pools</span>
              </TabsTrigger>
              <TabsTrigger value="games" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="truncate">Upcoming Games</span>
              </TabsTrigger>
              <TabsTrigger value="how-it-works" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">How It Works</span>
              </TabsTrigger>
            </TabsList>

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

            <TabsContent value="pools" className="mt-4 space-y-6">
              <WorldCupUrgencyBanner />
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

              <ActivePoolsTab userId={userId} />
            </TabsContent>

            <TabsContent value="games" className="mt-2">
              <UpcomingGamesTab />
            </TabsContent>

            <TabsContent value="how-it-works" className="mt-4">
              <HowItWorksTab currentPoints={liveTotalPoints} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

export function DashboardView(props: DashboardViewProps) {
  return (
    <Suspense fallback={null}>
      <DashboardViewContent {...props} />
    </Suspense>
  )
}
