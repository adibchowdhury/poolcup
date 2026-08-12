'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { useAuth } from '@/src/lib/auth-context'
import { cn } from '@/lib/utils'

const NUDGE_PENDING_KEY = 'poolcup_push_nudge_pending'
const NUDGE_DISMISSED_KEY = 'poolcup_push_nudge_dismissed'

/** Call after the user's first successful prediction save. */
export function markFirstPredictionForPushNudge(): void {
  try {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(NUDGE_DISMISSED_KEY) === '1') return
    if (localStorage.getItem(NUDGE_PENDING_KEY) === '1') return
    localStorage.setItem(NUDGE_PENDING_KEY, '1')
    window.dispatchEvent(new Event('poolcup-push-nudge'))
  } catch {
    /* ignore */
  }
}

export function PushNudgeHost() {
  const { user } = useAuth()
  const push = usePushSubscription()
  const [open, setOpen] = useState(false)
  const [enabling, setEnabling] = useState(false)

  const maybeOpen = useCallback(() => {
    try {
      if (!user) return
      if (localStorage.getItem(NUDGE_DISMISSED_KEY) === '1') return
      if (localStorage.getItem(NUDGE_PENDING_KEY) !== '1') return
      if (push.loading) return
      if (push.subscribed) {
        localStorage.setItem(NUDGE_DISMISSED_KEY, '1')
        localStorage.removeItem(NUDGE_PENDING_KEY)
        return
      }
      if (push.support === 'unsupported') return
      setOpen(true)
    } catch {
      /* ignore */
    }
  }, [user, push.loading, push.subscribed, push.support])

  useEffect(() => {
    maybeOpen()
    const onEvent = () => maybeOpen()
    window.addEventListener('poolcup-push-nudge', onEvent)
    return () => window.removeEventListener('poolcup-push-nudge', onEvent)
  }, [maybeOpen])

  function dismiss() {
    try {
      localStorage.setItem(NUDGE_DISMISSED_KEY, '1')
      localStorage.removeItem(NUDGE_PENDING_KEY)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  async function enable() {
    setEnabling(true)
    if (push.support === 'ios_needs_install') {
      setEnabling(false)
      return
    }
    const ok = await push.subscribe()
    setEnabling(false)
    if (ok) dismiss()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? dismiss() : setOpen(next))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <Bell className="h-5 w-5 text-primary" aria-hidden />
            Stay ahead of kickoff
          </DialogTitle>
          <DialogDescription>
            Enable push notifications so you get reminded before matches lock —
            and when your predictions are scored.
          </DialogDescription>
        </DialogHeader>

        {push.support === 'ios_needs_install' ? (
          <p className="text-sm text-muted-foreground">
            On iOS, add PoolCup to your Home Screen first, then enable push in{' '}
            <Link
              href="/settings/notifications"
              className={cn('text-primary underline', FOCUS_VISIBLE_RING)}
              onClick={dismiss}
            >
              Notification settings
            </Link>
            .
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            className={FOCUS_VISIBLE_RING}
            onClick={dismiss}
          >
            Not now
          </Button>
          {push.support === 'ios_needs_install' ? (
            <Button asChild className={FOCUS_VISIBLE_RING}>
              <Link href="/settings/notifications" onClick={dismiss}>
                Open settings
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              className={FOCUS_VISIBLE_RING}
              disabled={enabling}
              onClick={() => void enable()}
            >
              {enabling ? 'Enabling…' : 'Enable push'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
