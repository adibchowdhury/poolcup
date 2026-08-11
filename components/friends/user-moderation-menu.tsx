'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Ban, Loader2, MoreHorizontal, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/src/lib/auth-context'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  blockUser,
  isUserBlocked,
  isUserMuted,
  muteUser,
} from '@/src/lib/friendships'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

type UserModerationMenuProps = {
  targetUserId: string
  /** Optional: remove friend / cancel request slot rendered above mute/block. */
  extraItems?: ReactNode
  className?: string
  onMutedChange?: (muted: boolean) => void
  onBlockedChange?: (blocked: boolean) => void
  /** Fired after a successful block (friendship removed server-side). */
  onBlocked?: () => void
}

export function UserModerationMenu({
  targetUserId,
  extraItems,
  className,
  onMutedChange,
  onBlockedChange,
  onBlocked,
}: UserModerationMenuProps) {
  const { user, loading: authLoading } = useAuth()
  const [muted, setMuted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!user?.id || user.id === targetUserId) {
      setLoaded(true)
      return
    }
    const [nextMuted, nextBlocked] = await Promise.all([
      isUserMuted(supabase, targetUserId),
      isUserBlocked(supabase, targetUserId),
    ])
    setMuted(nextMuted)
    setBlocked(nextBlocked)
    setLoaded(true)
  }, [user?.id, targetUserId])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  if (authLoading || !user || user.id === targetUserId) return null

  async function handleMuteToggle() {
    if (busy) return
    const next = !muted
    setBusy(true)
    const result = await muteUser(supabase, targetUserId, next)
    setBusy(false)
    if (!result.ok) {
      toast.error(next ? 'Could not mute user' : 'Could not unmute user')
      return
    }
    setMuted(next)
    onMutedChange?.(next)
    capturePostHog('user_muted', {
      target_user_id: targetUserId,
      muted: next,
    })
    toast.success(next ? 'User muted' : 'User unmuted')
  }

  async function handleBlockToggle() {
    if (busy) return
    const next = !blocked
    if (next) {
      const confirmed = window.confirm(
        'Block this user? You’ll stop seeing their activity, and you won’t be friends anymore.',
      )
      if (!confirmed) return
    }
    setBusy(true)
    const result = await blockUser(supabase, targetUserId, next)
    setBusy(false)
    if (!result.ok) {
      toast.error(next ? 'Could not block user' : 'Could not unblock user')
      return
    }
    setBlocked(next)
    onBlockedChange?.(next)
    capturePostHog('user_blocked', {
      target_user_id: targetUserId,
      blocked: next,
    })
    if (next) {
      toast.success('User blocked')
      onBlocked?.()
    } else {
      toast.success('User unblocked')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || !loaded}
          className={cn(
            'h-8 w-8 shrink-0 p-0 text-muted-foreground',
            FOCUS_VISIBLE_RING,
            className,
          )}
          aria-label="More actions"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {extraItems}
        {extraItems ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          disabled={busy}
          onSelect={() => void handleMuteToggle()}
        >
          {muted ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
          {muted ? 'Unmute' : 'Mute'}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy}
          className={
            blocked
              ? undefined
              : 'text-destructive focus:text-destructive'
          }
          onSelect={() => void handleBlockToggle()}
        >
          <Ban className="h-4 w-4" aria-hidden />
          {blocked ? 'Unblock' : 'Block'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Small muted chip for friend rows. */
export function MutedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground',
        className,
      )}
    >
      <VolumeX className="h-2.5 w-2.5" aria-hidden />
      Muted
    </span>
  )
}
