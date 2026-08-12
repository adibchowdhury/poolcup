'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from '@/src/lib/notifications'
import {
  fetchNotificationPreferences,
  setNotificationPreference,
} from '@/src/lib/notifications-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export function NotificationPreferencesView({
  pushSection,
}: {
  pushSection?: ReactNode
}) {
  const [prefs, setPrefs] = useState<Record<NotificationCategory, boolean> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<NotificationCategory | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchNotificationPreferences()
    if (result.error) setError(result.error)
    setPrefs(result.prefs)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(category: NotificationCategory, enabled: boolean) {
    if (!prefs) return
    const previous = prefs[category]
    setPrefs({ ...prefs, [category]: enabled })
    setSaving(category)
    const result = await setNotificationPreference(category, enabled)
    setSaving(null)
    if (!result.ok) {
      setPrefs({ ...prefs, [category]: previous })
      setError(result.error ?? 'Could not save preference')
      return
    }
    capturePostHog('notification_pref_changed', { category, enabled })
  }

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/dashboard"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground',
            FOCUS_VISIBLE_RING,
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which updates appear in your notification center and on this
            device.
          </p>
        </div>
      </div>

      {pushSection ? <div className="mb-6">{pushSection}</div> : null}

      {loading && !prefs ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Loading" />
        </div>
      ) : error && !prefs ? (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            className={cn('mt-4', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : prefs ? (
        <ul className="space-y-2">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <li
              key={category}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {NOTIFICATION_CATEGORY_LABELS[category]}
                </p>
                <p className="text-xs text-muted-foreground">{category}</p>
              </div>
              <Switch
                checked={prefs[category]}
                disabled={saving === category}
                onCheckedChange={(checked) => void toggle(category, checked)}
                aria-label={NOTIFICATION_CATEGORY_LABELS[category]}
                className={FOCUS_VISIBLE_RING}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {error && prefs ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}
    </main>
  )
}
