'use client'

import Link from 'next/link'
import {
  Calendar,
  Plus,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSignOut } from '@/components/dashboard-sign-out'
import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { cn } from '@/lib/utils'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useMemo, useState } from 'react'

export type DashboardQuickStats = {
  totalPoints: number
  predictionsMade: number
  winRate: number | null
}

interface DashboardViewProps {
  userId: string
  email: string
  displayName?: string | null
  pools: DashboardPoolCardData[]
  quickStats: DashboardQuickStats
  passwordResetSuccess?: boolean
  errorMessage?: string | null
}

export function DashboardView({
  userId,
  email,
  displayName,
  pools,
  quickStats,
  passwordResetSuccess,
  errorMessage,
}: DashboardViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullName, setFullName] = useState(displayName ?? '')
  const [headerName, setHeaderName] = useState(displayName ?? '')
  const [newEmail, setNewEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmNextPassword, setConfirmNextPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    const name = displayName ?? ''
    setFullName(name)
    setHeaderName(name)
  }, [displayName])

  const canSaveProfile = useMemo(() => {
    return Boolean(fullName.trim()) || Boolean(newEmail.trim())
  }, [fullName, newEmail])

  async function handleSaveProfile() {
    setProfileSaving(true)
    setProfileMessage(null)
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

      if (newEmail.trim()) {
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
        if (error) throw error
        setNewEmail('')
      }

      setProfileMessage('Saved. Some email changes may require confirmation.')
    } catch (e: any) {
      setProfileMessage(e?.message ?? 'Failed to save profile')
    } finally {
      setProfileSaving(false)
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
    } catch (e: any) {
      setPasswordMessage(e?.message ?? 'Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const quickStatItems = [
    {
      label: 'Total Points',
      value: quickStats.totalPoints.toLocaleString(),
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
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary opacity-50 blur-lg" />
                  <div className="relative rounded-xl bg-primary p-2 text-primary-foreground">
                    <Trophy className="h-6 w-6" />
                  </div>
                </div>
                <h1 className="font-display text-4xl tracking-wide text-foreground">
                  MY POOLS
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DashboardSignOut displayName={headerName} />
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Settings</DialogTitle>
                      <DialogDescription>
                        Manage your account, security, and preferences.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="font-display text-xl tracking-wide">
                          Profile &amp; account
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Your name appears in the app. Email is used to sign in.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="settings-full-name">Full name</Label>
                          <Input
                            id="settings-full-name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Account email</Label>
                          <div className="h-9 w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {email}
                          </div>
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
                        {profileMessage ? (
                          <p className="text-sm text-muted-foreground">{profileMessage}</p>
                        ) : (
                          <span />
                        )}
                        <Button
                          type="button"
                          onClick={handleSaveProfile}
                          disabled={profileSaving || !canSaveProfile}
                        >
                          {profileSaving ? 'Saving…' : 'Save profile'}
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
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
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

          <Tabs defaultValue="profile" className="gap-6">
            <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 gap-1 p-1">
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
            </TabsList>

            <TabsContent value="profile" className="mt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {quickStatItems.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex cursor-default items-center gap-4 rounded-2xl border border-border bg-card p-4 hover-lift"
                  >
                    <div className={cn('rounded-xl bg-muted p-3', stat.color)}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-display text-3xl text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pools" className="mt-0 space-y-6">
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {pools.map((pool) => (
                  <PoolCard key={pool.id} pool={pool} />
                ))}

                <Link
                  href="/create"
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-[#ffb300]/5 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted transition-transform group-hover:scale-110">
                      <Plus className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <h3 className="mb-2 font-display text-xl text-foreground">
                      Join or Create a Pool
                    </h3>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Start competing with friends or join an existing pool with an
                      invite code
                    </p>
                  </div>
                </Link>
              </div>

              {pools.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No pools yet — create one or join with an invite link from a friend.
                </p>
              )}
            </TabsContent>

            <TabsContent value="games" className="mt-0" />
          </Tabs>
        </main>
      </div>
    </div>
  )
}
