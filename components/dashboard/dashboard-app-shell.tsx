'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Heart, Mail, Settings, CircleHelp, Users, CreditCard, History, BarChart3, CalendarRange } from 'lucide-react'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BadgeUnlockProvider } from '@/components/achievements/badge-unlock-provider'
import { useDashboardSignOut } from '@/components/dashboard-sign-out'
import { DeleteAccountSection } from '@/components/dashboard/delete-account-section'
import { ThemeAppearanceSetting } from '@/components/theme-appearance-setting'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { ReportIssueButton } from '@/components/report-issue-dialog'
import { WebMobileAppDrawer } from '@/components/dashboard/web-mobile-app-drawer'
import { WebMobileProfilePopover } from '@/components/dashboard/web-mobile-profile-popover'
import { WebMobileTopBar } from '@/components/dashboard/web-mobile-top-bar'
import { HeaderChatButton } from '@/components/dashboard/header-chat-button'
import { HeaderNotificationBell } from '@/components/dashboard/header-notification-bell'
import { buildStripeDonateUrl } from '@/src/lib/stripe-donate-url'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS, DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { supabase } from '@/src/lib/supabase'

export type DashboardAppShellProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
  children: React.ReactNode
  mainClassName?: string
}

export function DashboardAppShell({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
  children,
  mainClassName,
}: DashboardAppShellProps) {
  const { count: friendRequestCount } = useFriendRequestCount()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmNextPassword, setConfirmNextPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const { handleSignOut, loading: signOutLoading } = useDashboardSignOut()

  const headerName = displayName ?? ''

  const canSaveEmail = useMemo(() => Boolean(newEmail.trim()), [newEmail])

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update email'
      setAccountMessage(message)
    } finally {
      setAccountSaving(false)
    }
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update password'
      setPasswordMessage(message)
    } finally {
      setPasswordSaving(false)
    }
  }

  useEffect(() => {
    if (!settingsOpen) return
    setAccountMessage(null)
    setPasswordMessage(null)
  }, [settingsOpen])

  return (
    <BadgeUnlockProvider>
    <div className="min-h-screen max-w-full min-w-0 overflow-x-clip bg-app-background">
      <div className="relative max-w-full min-w-0">
        <div className="z-50 bg-app-background md:sticky md:top-0">
          {/*
            Safe-area spacer only (notch/status bar). Extra breathing room
            above the logo/menu was removed — height is env(safe-area-inset-top).
          */}
          <div
            aria-hidden
            className="dashboard-header-top-gap w-full shrink-0"
          />
          <header className="border-b border-border bg-app-background/80 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4">
              {/* Mobile-only header (app layout): hamburger | logo | profile */}
              <WebMobileTopBar
                className="sm:hidden"
                displayName={headerName}
                avatar={avatar}
                customAvatarUrl={customAvatarUrl}
                onOpenDrawer={() => {
                  setProfilePopoverOpen(false)
                  setDrawerOpen(true)
                }}
                onOpenProfilePopover={() => {
                  setDrawerOpen(false)
                  setProfilePopoverOpen(true)
                }}
              />

              {/* Desktop header */}
              <div className="hidden items-center justify-between gap-2 py-4 sm:flex sm:gap-3">
                <PoolCupLogo href="/dashboard" />

                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
                  <ReportIssueButton />

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <HeaderChatButton />
                    <HeaderNotificationBell />
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
                            <UserAvatarImage
                              avatar={avatar}
                              customAvatarUrl={customAvatarUrl}
                              className="size-full rounded-full border-0"
                            />
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                          {email}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/friends" className="relative">
                            <Users className="h-4 w-4" />
                            Friends
                            {friendRequestCount > 0 ? (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                                {friendRequestCount > 9
                                  ? '9+'
                                  : friendRequestCount}
                              </span>
                            ) : null}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/history">
                            <History className="h-4 w-4" />
                            Prediction history
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/analytics">
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/history-performance">
                            <CalendarRange className="h-4 w-4" />
                            Historical performance
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                          <Settings className="h-4 w-4" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/settings/billing">
                            <CreditCard className="h-4 w-4" />
                            Billing
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={buildStripeDonateUrl(userId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Heart className="h-4 w-4" />
                            Support Us
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={DASHBOARD_TAB_HREFS['how-it-works']}>
                            <CircleHelp className="h-4 w-4" />
                            Help
                          </Link>
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

          <WebMobileAppDrawer
            open={drawerOpen}
            userId={userId}
            signOutLoading={signOutLoading}
            onClose={() => setDrawerOpen(false)}
            onSignOut={() => {
              void handleSignOut()
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <WebMobileProfilePopover
            open={profilePopoverOpen}
            displayName={headerName}
            email={email}
            avatar={avatar}
            customAvatarUrl={customAvatarUrl}
            onClose={() => setProfilePopoverOpen(false)}
          />

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
                      Appearance
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choose light or dark for tokenized surfaces across the app.
                    </p>
                    <ThemeAppearanceSetting />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="font-display text-xl tracking-wide">
                      Notifications
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choose which updates appear in your notification center.
                    </p>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link
                        href="/settings/notifications"
                        onClick={() => setSettingsOpen(false)}
                      >
                        Notification preferences
                      </Link>
                    </Button>
                  </div>

                  <Separator />

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
                      onClick={() => void handleSaveEmail()}
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
                      onClick={() => void handleUpdatePassword()}
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

        <main
          className={cn(
            'mx-auto w-full min-w-0 max-w-6xl px-4 py-8',
            MOBILE_BOTTOM_NAV_PAD_CLASS,
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
    </BadgeUnlockProvider>
  )
}
