'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV } from '@/src/lib/admin-console-shared'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'

export function AdminShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const pathname = usePathname()

  useEffect(() => {
    capturePostHog('admin_console_viewed', { path: pathname })
  }, [pathname])

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            PoolCup Admin
          </p>
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            {title}
          </h1>
        </div>
        <Link
          href="/dashboard"
          className={cn(
            'text-sm text-muted-foreground hover:text-foreground rounded-md',
            FOCUS_VISIBLE_RING,
          )}
        >
          ← Back to app
        </Link>
      </div>

      <nav
        aria-label="Admin sections"
        className="mb-8 flex gap-1 overflow-x-auto pb-1"
      >
        {ADMIN_NAV.map((item) => {
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                FOCUS_VISIBLE_RING,
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </main>
  )
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="space-y-2" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline',
            FOCUS_VISIBLE_RING,
          )}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function formatAdminWhen(value: string | null | undefined): string {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return value
  return new Date(ms).toLocaleString()
}

export function formatUsd(amount: number | null | undefined): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n)
}
