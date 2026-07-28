'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { cn } from '@/lib/utils'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

type WebMobileProfilePopoverProps = {
  open: boolean
  displayName: string | null
  email: string | null
  avatar: string | null | undefined
  customAvatarUrl: string | null | undefined
  onClose: () => void
}

export function WebMobileProfilePopover({
  open,
  displayName,
  email,
  avatar,
  customAvatarUrl,
  onClose,
}: WebMobileProfilePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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
      <div
        className="fixed inset-0 z-[55] sm:hidden"
        aria-hidden
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(
          'fixed right-4 z-[56] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg sm:hidden',
          'top-[calc(3.5rem+0.5rem)]',
        )}
        role="dialog"
        aria-label="Profile menu"
      >
        <div className="flex items-center gap-3">
          <UserAvatarImage
            avatar={avatar}
            customAvatarUrl={customAvatarUrl}
            className="h-12 w-12 border border-border"
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
            router.push(DASHBOARD_TAB_HREFS.profile)
          }}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Profile settings
        </button>
      </div>
    </>
  )
}
