'use client'

import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CurrentUserAvatar } from './current-user-avatar'
import type { CurrentUserAvatarState } from '../lib/resolve-current-user-avatar'

export const MOBILE_TOP_BAR_HEIGHT =
  'var(--mobile-top-bar-height, calc(3.5rem + env(safe-area-inset-top, 0px)))'

/** Bar content row only — .app-shell already applies the top safe-area inset once. */
export const MOBILE_TOP_BAR_SCROLL_PAD_CLASS =
  'pt-[var(--mobile-top-bar-content-height,3.5rem)]'

type MobileTopBarProps = {
  displayName: string | null
  email: string | null
  currentUserAvatar: CurrentUserAvatarState
  onOpenDrawer: () => void
  onOpenProfilePopover: () => void
}

function ProfileCircle({
  displayName,
  currentUserAvatar,
  onClick,
}: {
  displayName: string | null
  currentUserAvatar: CurrentUserAvatarState
  onClick: () => void
}) {
  const label = displayName?.trim() || 'Profile'

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full transition-colors hover:opacity-90"
      aria-label={`${label} menu`}
    >
      <CurrentUserAvatar
        custom_avatar_url={currentUserAvatar.customAvatarUrl}
        avatar={currentUserAvatar.avatarPreset}
        size="sm"
      />
    </button>
  )
}

export function MobileTopBar({
  displayName,
  email,
  currentUserAvatar,
  onOpenDrawer,
  onOpenProfilePopover,
}: MobileTopBarProps) {
  void email

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md',
        'pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))]',
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/50"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/poolcup-logo.png"
          alt="PoolCup"
          className="h-8 w-auto shrink-0 object-contain"
        />

        <div className="min-w-0 flex-1" aria-hidden />

        <ProfileCircle
          displayName={displayName}
          currentUserAvatar={currentUserAvatar}
          onClick={onOpenProfilePopover}
        />
      </div>
    </header>
  )
}
