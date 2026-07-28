'use client'

import { Menu } from 'lucide-react'
import Link from 'next/link'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { HeaderNotificationBell } from '@/components/dashboard/header-notification-bell'
import { cn } from '@/lib/utils'

type WebMobileTopBarProps = {
  displayName: string | null
  avatar: string | null | undefined
  customAvatarUrl: string | null | undefined
  onOpenDrawer: () => void
  onOpenProfilePopover: () => void
  className?: string
}

export function WebMobileTopBar({
  displayName,
  avatar,
  customAvatarUrl,
  onOpenDrawer,
  onOpenProfilePopover,
  className,
}: WebMobileTopBarProps) {
  const label = displayName?.trim() || 'Profile'

  return (
    <div
      className={cn(
        'flex h-14 items-center gap-3',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpenDrawer}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/50"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" aria-hidden />
      </button>

      <Link href="/dashboard" className="shrink-0" aria-label="PoolCup home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/poolcup-logo.png"
          alt="PoolCup"
          className="h-8 w-auto object-contain"
        />
      </Link>

      <div className="min-w-0 flex-1" aria-hidden />

      <HeaderNotificationBell />

      <button
        type="button"
        onClick={onOpenProfilePopover}
        className="rounded-full transition-opacity hover:opacity-90"
        aria-label={`${label} menu`}
      >
        <UserAvatarImage
          avatar={avatar}
          customAvatarUrl={customAvatarUrl}
          className="h-9 w-9 border border-border"
        />
      </button>
    </div>
  )
}
