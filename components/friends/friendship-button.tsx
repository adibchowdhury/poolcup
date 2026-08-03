'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, UserPlus, UserCheck, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import {
  acceptFriendRequest,
  getFriendshipStatus,
  removeFriend,
  sendFriendRequest,
  statusAfterSend,
  type FriendshipStatus,
} from '@/src/lib/friendships'
import { emitFriendRequestsChanged } from '@/hooks/use-friend-request-count'
import { supabase } from '@/src/lib/supabase'

type FriendshipButtonProps = {
  profileUserId: string
  className?: string
}

export function FriendshipButton({
  profileUserId,
  className,
}: FriendshipButtonProps) {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<FriendshipStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const loadStatus = useCallback(async () => {
    if (!user?.id || !profileUserId || user.id === profileUserId) {
      setStatus('self')
      return
    }
    const next = await getFriendshipStatus(supabase, profileUserId)
    setStatus(next)
  }, [user?.id, profileUserId])

  useEffect(() => {
    if (authLoading) return
    void loadStatus()
  }, [authLoading, loadStatus])

  if (authLoading || status === null) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={cn('h-8 min-w-[8.5rem] gap-1.5', className)}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading…
      </Button>
    )
  }

  if (status === 'self') return null

  if (!user) {
    const next = `/u/${profileUserId}`
    return (
      <Button asChild size="sm" className={cn('h-8 gap-1.5', className)}>
        <Link href={`/login?next=${encodeURIComponent(next)}`}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          Add friend
        </Link>
      </Button>
    )
  }

  async function handleAdd() {
    if (busy) return
    const previous = status
    setBusy(true)
    setStatus('request_sent')
    const result = await sendFriendRequest(supabase, profileUserId)
    setBusy(false)
    if (!result.ok) {
      setStatus(previous)
      toast.error('Could not send friend request')
      return
    }
    const mapped = statusAfterSend(result.result)
    if (!mapped) {
      setStatus(previous)
      toast.error(
        result.result === 'no_user'
          ? 'User not found'
          : 'Could not send friend request',
      )
      return
    }
    setStatus(mapped)
    toast.success(
      mapped === 'friends' ? 'You are now friends' : 'Friend request sent',
    )
  }

  async function handleAccept() {
    if (busy) return
    const previous = status
    setBusy(true)
    setStatus('friends')
    const result = await acceptFriendRequest(supabase, profileUserId)
    setBusy(false)
    if (!result.ok || result.result !== 'accepted') {
      setStatus(previous)
      toast.error('Could not accept request')
      return
    }
    toast.success('You are now friends')
    emitFriendRequestsChanged()
  }

  async function handleRemove(successMessage: string) {
    if (busy) return
    const previous = status
    setBusy(true)
    setStatus('none')
    const result = await removeFriend(supabase, profileUserId)
    setBusy(false)
    if (!result.ok) {
      setStatus(previous)
      toast.error('Something went wrong')
      return
    }
    toast.success(successMessage)
  }

  if (status === 'none') {
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void handleAdd()}
        className={cn('h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90', className)}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
        )}
        Add friend
      </Button>
    )
  }

  if (status === 'request_sent') {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void handleRemove('Request cancelled')}
        className={cn('h-8 gap-1.5 text-muted-foreground', className)}
        title="Cancel request"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <UserMinus className="h-3.5 w-3.5" aria-hidden />
        )}
        Request sent
      </Button>
    )
  }

  if (status === 'request_received') {
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void handleAccept()}
        className={cn('h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90', className)}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <UserCheck className="h-3.5 w-3.5" aria-hidden />
        )}
        Accept request
      </Button>
    )
  }

  // friends
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          className={cn(
            'h-8 gap-1.5 border-primary/35 bg-primary/10 text-primary hover:bg-primary/15',
            className,
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          Friends
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-44">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => void handleRemove('Friend removed')}
        >
          <UserMinus className="h-4 w-4" aria-hidden />
          Remove friend
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
