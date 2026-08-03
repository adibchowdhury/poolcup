'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { cn } from '@/lib/utils'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
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
  const { count: friendRequestCount } = useFriendRequestCount()

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

        <button
          type="button"
          onClick={() => {
            onClose()
            router.push('/friends')
          }}
          className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <Users className="h-4 w-4 text-primary" aria-hidden />
          Friends
          {friendRequestCount > 0 ? (
            <span
              className="absolute right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground"
              aria-label={`${friendRequestCount} friend requests`}
            >
              {friendRequestCount > 9 ? '9+' : friendRequestCount}
            </span>
          ) : null}
        </button>
      </div>
    </>
  )
}
