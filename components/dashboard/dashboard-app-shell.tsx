'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BadgeUnlockProvider } from '@/components/achievements/badge-unlock-provider'
import { useDashboardSignOut } from '@/components/dashboard-sign-out'
import { DeleteAccountSection } from '@/components/dashboard/delete-account-section'
import { ThemeAppearanceSetting } from '@/components/theme-appearance-setting'
import { WebMobileAppDrawer } from '@/components/dashboard/web-mobile-app-drawer'
import { WebMobileProfilePopover } from '@/components/dashboard/web-mobile-profile-popover'
import { WebMobileTopBar } from '@/components/dashboard/web-mobile-top-bar'
import { HubDesktopSidebar } from '@/components/dashboard/hub-desktop-sidebar'
import { HubDesktopContentTopBar } from '@/components/dashboard/hub-desktop-content-top-bar'
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
import { useHubChromeProfileOptional } from '@/components/dashboard/hub-chrome-profile'
import { useHubLayoutNested } from '@/components/dashboard/hub-layout-context'
import {
  HUB_DESKTOP_CONTENT_GUTTER_CLASS,
  type HubDesktopNavId,
} from '@/components/dashboard/hub-desktop-nav-frame'
import {
  DASHBOARD_CANVAS_CLASS,
  isDashboardRoutePath,
} from '@/src/lib/dashboard-surfaces'
import { cn } from '@/lib/utils'
import {
  MOBILE_BOTTOM_NAV_PAD_CLASS,
  resolveHubDesktopNavValue,
} from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import {
  clearCreateModeDashboardExitClass,
  consumeCreatePoolTransition,
} from '@/src/lib/create-pool-transition'

export type DashboardAppShellProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
  children: React.ReactNode
  /** Dashboard route canvas override (e.g. #0D0D0D); does not change global tokens. */
  hubCanvasClassName?: string
  mainClassName?: string
  /** Desktop primary nav active item; nav renders outside content max-width. */
  hubActiveNav?: HubDesktopNavId | string
  /** Link Home / Matches / Profile to /dashboard tabs (unused; nav always links). */
  linkDashboardTabs?: boolean
  /** Always render the hub desktop nav (hub layout). */
  forceHubNav?: boolean
  /** Optional desktop top-bar title override. */
  contentTitle?: string
}

export function DashboardAppShell({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
  children,
  hubCanvasClassName,
  mainClassName,
  hubActiveNav,
  linkDashboardTabs: _linkDashboardTabs = true,
  forceHubNav = false,
  contentTitle,
}: DashboardAppShellProps) {
  const nestedInHubLayout = useHubLayoutNested()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const chrome = useHubChromeProfileOptional()
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
  const canSaveEmail = useMemo(() => Boolean(newEmail.trim()), [newEmail])

  const resolvedHubNav =
    hubActiveNav ??
    resolveHubDesktopNavValue(pathname, searchParams.get('tab'))
  const headerName = chrome?.displayName ?? displayName ?? ''
  const headerAvatar = chrome?.avatar ?? avatar
  const headerCustomAvatarUrl = chrome?.customAvatarUrl ?? customAvatarUrl

  useEffect(() => {
    if (!settingsOpen) return
    setAccountMessage(null)
    setPasswordMessage(null)
  }, [settingsOpen])

  useEffect(() => {
    if (nestedInHubLayout) return
    clearCreateModeDashboardExitClass()
    const kind = consumeCreatePoolTransition()
    if (kind !== 'exit') return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    const root = document.documentElement
    root.classList.add('create-mode-dashboard-restore')
    const clear = () => {
      root.classList.remove('create-mode-dashboard-restore')
    }
    const timer = window.setTimeout(clear, 280)
    return () => {
      window.clearTimeout(timer)
      clear()
    }
  }, [nestedInHubLayout])

  if (nestedInHubLayout) {
    if (!mainClassName) return children
    return (
      <div className={cn('mx-auto w-full', mainClassName)}>{children}</div>
    )
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

  const showHubNav = forceHubNav || resolvedHubNav != null
  const isDashboardCanvas = isDashboardRoutePath(pathname)
  const canvasClass =
    hubCanvasClassName ??
    (isDashboardCanvas ? DASHBOARD_CANVAS_CLASS : 'bg-app-background')
  const chromeSurfaceClass = isDashboardCanvas
    ? 'bg-[#0D0D0D]/95'
    : 'bg-[#0A0E0E]/95'

  return (
    <BadgeUnlockProvider>
      <div
        data-hub-shell
        className={cn('min-h-screen max-w-full min-w-0 overflow-x-clip lg:flex', canvasClass)}
      >
        {showHubNav ? (
          <HubDesktopSidebar
            userId={userId}
            email={email}
            displayName={headerName}
            avatar={headerAvatar}
            customAvatarUrl={headerCustomAvatarUrl}
            onOpenSettings={() => setSettingsOpen(true)}
            signOutLoading={signOutLoading}
            onSignOut={() => {
              void handleSignOut()
            }}
          />
        ) : null}

        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <div className={cn('z-50 shrink-0 lg:hidden', canvasClass)}>
            <div
              aria-hidden
              className="dashboard-header-top-gap w-full shrink-0"
            />
            <header className={cn('border-b border-border backdrop-blur-xl', canvasClass, 'bg-opacity-80')}>
              <div className="mx-auto max-w-6xl px-4">
                <WebMobileTopBar
                  displayName={headerName}
                  avatar={headerAvatar}
                  customAvatarUrl={headerCustomAvatarUrl}
                  onOpenDrawer={() => {
                    setProfilePopoverOpen(false)
                    setDrawerOpen(true)
                  }}
                  onOpenProfilePopover={() => {
                    setDrawerOpen(false)
                    setProfilePopoverOpen(true)
                  }}
                />
              </div>
            </header>
          </div>

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
            avatar={headerAvatar}
            customAvatarUrl={headerCustomAvatarUrl}
            onClose={() => setProfilePopoverOpen(false)}
          />

          {showHubNav ? (
            <HubDesktopContentTopBar
              title={contentTitle}
              chromeSurfaceClass={chromeSurfaceClass}
            />
          ) : null}

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

                  <DeleteAccountSection userId={userId} avatar={headerAvatar} />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <main
            className={cn(
              'mx-auto w-full min-w-0 flex-1 bg-transparent py-6 lg:py-8',
              showHubNav
                ? cn('lg:max-w-none', HUB_DESKTOP_CONTENT_GUTTER_CLASS)
                : 'max-w-6xl px-4',
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
