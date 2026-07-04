'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CurrentUserAvatar } from './current-user-avatar'
import type { CurrentUserAvatarState } from '../lib/resolve-current-user-avatar'

type MobileProfilePopoverProps = {
  open: boolean
  displayName: string | null
  email: string | null
  currentUserAvatar: CurrentUserAvatarState
  onClose: () => void
  onOpenProfileTab: () => void
}

export function MobileProfilePopover({
  open,
  displayName,
  email,
  currentUserAvatar,
  onClose,
  onOpenProfileTab,
}: MobileProfilePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, onClose])

  if (!open) return null

  const name = displayName?.trim() || 'Your profile'

  return (
    <>
      <div className="fixed inset-0 z-[55]" aria-hidden onClick={onClose} />

      <div
        ref={panelRef}
        className={cn(
          'fixed right-4 z-[56] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg',
          'top-[calc(var(--mobile-top-bar-height,3.5rem)+0.5rem)]',
        )}
        role="dialog"
        aria-label="Profile menu"
      >
        <div className="flex items-center gap-3">
          <CurrentUserAvatar
            custom_avatar_url={currentUserAvatar.customAvatarUrl}
            avatar={currentUserAvatar.avatarPreset}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{name}</p>
            {email ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose()
            onOpenProfileTab()
          }}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Profile settings
        </button>
      </div>
    </>
  )
}
