'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import { initialsFromDisplayName } from '@/src/lib/pool-chat-helpers'

type MobileProfilePopoverProps = {
  open: boolean
  displayName: string | null
  email: string | null
  avatarFilename: string | null
  onClose: () => void
  onOpenProfileTab: () => void
}

export function MobileProfilePopover({
  open,
  displayName,
  email,
  avatarFilename,
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
  const showImage = Boolean(avatarFilename?.trim())

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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getAvatarSrc(avatarFilename)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-foreground">
                {initialsFromDisplayName(displayName ?? 'You')}
              </span>
            )}
          </div>
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
