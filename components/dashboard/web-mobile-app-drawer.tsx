'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Flag,
  Heart,
  HelpCircle,
  History,
  BarChart3,
  LogOut,
  Mail,
  Settings,
  Shield,
  UserPlus,
  X,
} from 'lucide-react'
import { useReportIssue } from '@/components/report-issue-dialog'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { buildStripeDonateUrl } from '@/src/lib/stripe-donate-url'

type WebMobileAppDrawerProps = {
  open: boolean
  userId: string
  signOutLoading: boolean
  onClose: () => void
  onSignOut: () => void
  onOpenSettings: () => void
}

type DrawerItem = {
  id: string
  label: string
  icon: typeof Heart
  action: () => void
  destructive?: boolean
}

/**
 * Website destinations (real pages only):
 * - Join a pool → /dashboard?tab=dashboard (join/create card)
 * - Support us → Stripe donate
 * - Settings / Account & security → settings dialog
 * - Help → /dashboard?tab=how-it-works
 * - Contact → /contact
 * - Log out → site sign-out
 * Omitted (no real website page): Invite friends
 */
export function WebMobileAppDrawer({
  open,
  userId,
  signOutLoading,
  onClose,
  onSignOut,
  onOpenSettings,
}: WebMobileAppDrawerProps) {
  const router = useRouter()
  const { openReportIssue } = useReportIssue()

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
      action: () => {
        router.push(DASHBOARD_TAB_HREFS.dashboard)
      },
    },
    {
      id: 'history',
      label: 'Prediction history',
      icon: History,
      action: () => {
        router.push('/history')
      },
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      action: () => {
        router.push('/analytics')
      },
    },
    {
      id: 'support-us',
      label: 'Support us',
      icon: Heart,
      action: () => {
        window.open(
          buildStripeDonateUrl(userId),
          '_blank',
          'noopener,noreferrer',
        )
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: onOpenSettings,
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: CreditCard,
      action: () => {
        router.push('/settings/billing')
      },
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      action: () => {
        router.push(DASHBOARD_TAB_HREFS['how-it-works'])
      },
    },
    {
      id: 'contact',
      label: 'Contact',
      icon: Mail,
      action: () => {
        router.push('/contact')
      },
    },
    {
      id: 'account-security',
      label: 'Account & security',
      icon: Shield,
      action: onOpenSettings,
    },
    {
      id: 'log-out',
      label: 'Log out',
      icon: LogOut,
      action: onSignOut,
      destructive: true,
    },
  ]

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 sm:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,85vw)] flex-col border-r border-border bg-background shadow-xl transition-transform duration-300 ease-out sm:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]',
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
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
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
                  FOCUS_VISIBLE_RING,
                  item.destructive
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
            onClick={() =>
              navigate(() => {
                openReportIssue()
              })
            }
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
          >
            <Flag className="h-4 w-4 shrink-0" aria-hidden />
            <span>Report an issue</span>
          </button>
        </div>
      </aside>
    </>
  )
}
