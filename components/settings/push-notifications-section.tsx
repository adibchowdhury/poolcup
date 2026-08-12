'use client'

import { useState } from 'react'
import { BellRing, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

export function PushNotificationsSection() {
  const push = usePushSubscription()
  const [testing, setTesting] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onToggle(enabled: boolean) {
    setBusy(true)
    if (enabled) await push.subscribe()
    else await push.unsubscribe()
    setBusy(false)
  }

  async function onTest() {
    setTesting(true)
    await push.sendTest()
    setTesting(false)
  }

  if (push.loading && push.support === 'loading') {
    return (
      <section className="rounded-2xl border border-border bg-card/70 px-3.5 py-8 text-center">
        <Loader2
          className="mx-auto h-6 w-6 animate-spin text-primary"
          aria-label="Loading push settings"
        />
      </section>
    )
  }

  if (push.support === 'error' && !push.subscribed) {
    return (
      <section className="rounded-2xl border border-border bg-card/70 px-3.5 py-6 text-center">
        <p className="text-sm text-destructive">
          {push.error ?? 'Could not load push settings'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('mt-3', FOCUS_VISIBLE_RING)}
          onClick={() => void push.refresh()}
        >
          Try again
        </Button>
      </section>
    )
  }

  if (push.support === 'unsupported') {
    return (
      <section className="rounded-2xl border border-border bg-card/70 px-3.5 py-4">
        <h2 className="font-display text-xl tracking-wide text-foreground">
          Browser push
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This browser does not support web push notifications.
        </p>
      </section>
    )
  }

  if (push.support === 'ios_needs_install') {
    return (
      <section className="rounded-2xl border border-border bg-card/70 px-3.5 py-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Browser push
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              On iPhone and iPad, add PoolCup to your Home Screen first, then open
              it from there to enable push notifications.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Safari → Share → Add to Home Screen
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card/70 px-3.5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            Browser push
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get alerts for scored predictions, pool announcements, and matches
            locking soon — even when PoolCup is closed.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Permission:{' '}
            <span className="font-medium text-foreground">{push.permission}</span>
            {push.subscribed ? ' · Subscribed on this device' : ''}
          </p>
        </div>
        <Switch
          checked={push.subscribed}
          disabled={busy}
          onCheckedChange={(checked) => void onToggle(checked)}
          aria-label="Enable push notifications"
          className={FOCUS_VISIBLE_RING}
        />
      </div>

      {push.error ? (
        <p className="text-sm text-destructive" role="alert">
          {push.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={FOCUS_VISIBLE_RING}
          disabled={!push.subscribed || testing}
          onClick={() => void onTest()}
        >
          {testing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <BellRing className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          Send test notification
        </Button>
      </div>
    </section>
  )
}
