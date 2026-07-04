'use client'

import { useEffect } from 'react'
import {
  Heart,
  HelpCircle,
  LogOut,
  Mail,
  Settings,
  Shield,
  Trophy,
  UserPlus,
  X,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildStripeDonateUrl } from '@/src/lib/stripe-donate-url'
import type { MobileOverlayPageId } from '../lib/mobile-overlay-pages'
import { SUPPORT_EMAIL } from '../lib/mobile-overlay-pages'

type MobileAppDrawerProps = {
  open: boolean
  userId: string | null
  signOutLoading: boolean
  onClose: () => void
  onSignOut: () => void
  onOpenOverlay: (pageId: MobileOverlayPageId) => void
  onJoinPool: () => void
}

type DrawerItem = {
  id: string
  label: string
  icon: typeof Heart
  action: () => void
}

export function MobileAppDrawer({
  open,
  userId,
  signOutLoading,
  onClose,
  onSignOut,
  onOpenOverlay,
  onJoinPool,
}: MobileAppDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  function navigate(action: () => void) {
    action()
    onClose()
  }

  const items: DrawerItem[] = [
    {
      id: 'join-pool',
      label: 'Join a pool',
      icon: UserPlus,
      action: onJoinPool,
    },
    {
      id: 'support-us',
      label: 'Support us',
      icon: Heart,
      action: () => {
        const href = buildStripeDonateUrl(userId ?? undefined)
        window.open(href, '_blank', 'noopener,noreferrer')
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => onOpenOverlay('settings'),
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      action: () => onOpenOverlay('help'),
    },
    {
      id: 'contact',
      label: 'Contact',
      icon: Mail,
      action: () => {
        window.location.href = `mailto:${SUPPORT_EMAIL}`
      },
    },
    {
      id: 'invite-friends',
      label: 'Invite friends',
      icon: UserPlus,
      action: () => onOpenOverlay('invite-friends'),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: Trophy,
      action: () => onOpenOverlay('leaderboard'),
    },
    {
      id: 'account-security',
      label: 'Account & security',
      icon: Shield,
      action: () => onOpenOverlay('account-security'),
    },
    {
      id: 'log-out',
      label: 'Log out',
      icon: LogOut,
      action: onSignOut,
    },
  ]

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,85vw)] flex-col border-r border-border bg-background shadow-xl transition-transform duration-300 ease-out',
          'pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))]',
          'pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
        aria-label="App menu"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4">
          <span className="font-display text-lg tracking-wide text-foreground">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {items.map((item) => {
            const Icon = item.icon
            const isLogOut = item.id === 'log-out'

            return (
              <button
                key={item.id}
                type="button"
                disabled={isLogOut && signOutLoading}
                onClick={() => navigate(item.action)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors',
                  isLogOut
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                <span className="font-medium">
                  {isLogOut && signOutLoading ? 'Signing out…' : item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-border/80 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(() => onOpenOverlay('report-issue'))}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Flag className="h-4 w-4 shrink-0" aria-hidden />
            <span>Report an issue</span>
          </button>
        </div>
      </aside>
    </>
  )
}
