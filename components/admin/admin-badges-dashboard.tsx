'use client'

import { useCallback, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  achievementRarityLabel,
  ACHIEVEMENT_RARITY_STYLES,
} from '@/src/lib/achievement-rarity'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'
import { AdminErrorState } from '@/components/admin/admin-shell'

type SearchUser = {
  user_id: string
  display_name: string | null
  username: string | null
  avatar: string | null
  custom_avatar_url: string | null
}

type AdminBadgeRow = {
  id: string
  name: string
  description: string
  rarity: string | null
  xp_value: number
  art_filename: string | null
  is_active: boolean
  list_order: number | null
  imageUrl: string
  earned: boolean
  earned_at: string | null
}

type SelectedUser = {
  id: string
  display_name: string | null
  username: string | null
}

export function AdminBadgesDashboard() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchErrorRetryable, setSearchErrorRetryable] = useState(false)
  const [results, setResults] = useState<SearchUser[]>([])
  const [selected, setSelected] = useState<SelectedUser | null>(null)
  const [badges, setBadges] = useState<AdminBadgeRow[]>([])
  const [loadingUser, setLoadingUser] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'earned' | 'missing'>('all')

  const loadUser = useCallback(async (userId: string) => {
    setLoadingUser(true)
    setMessage(null)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/admin/badges?userId=${encodeURIComponent(userId)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as {
        user?: SelectedUser
        badges?: AdminBadgeRow[]
        error?: string
      }
      if (!res.ok) {
        setLoadError(json.error ?? 'Failed to load user badges')
        setBadges([])
        return
      }
      setSelected(json.user ?? null)
      setBadges(json.badges ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load')
      setBadges([])
    } finally {
      setLoadingUser(false)
    }
  }, [])

  async function runSearch() {
    const q = query.trim()
    if (q.length < 2) {
      setSearchError('Enter at least 2 characters')
      setSearchErrorRetryable(false)
      return
    }
    setSearching(true)
    setSearchError(null)
    setSearchErrorRetryable(false)
    try {
      const res = await fetch(
        `/api/admin/badges?q=${encodeURIComponent(q)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as {
        users?: SearchUser[]
        error?: string
      }
      if (!res.ok) {
        setSearchError(json.error ?? 'Search failed')
        setSearchErrorRetryable(true)
        setResults([])
      } else {
        setResults(json.users ?? [])
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
      setSearchErrorRetryable(true)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function mutate(action: 'award' | 'revoke', achievementId: string) {
    if (!selected) return
    if (
      action === 'revoke' &&
      !window.confirm(
        `Revoke badge “${achievementId}” from this user? This also removes the ledger XP row.`,
      )
    ) {
      return
    }

    setBusyId(achievementId)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/badges/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: selected.id,
          achievementId,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setMessage(json.error ?? 'Action failed')
        return
      }
      capturePostHog(
        action === 'award' ? 'admin_badge_awarded' : 'admin_badge_revoked',
        {
          achievement_id: achievementId,
          target_user_id: selected.id,
        },
      )
      setMessage(
        action === 'award'
          ? `Awarded ${achievementId}`
          : `Revoked ${achievementId}`,
      )
      await loadUser(selected.id)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const visible = useMemo(() => {
    if (filter === 'earned') return badges.filter((b) => b.earned)
    if (filter === 'missing') return badges.filter((b) => !b.earned && b.is_active)
    return badges
  }, [badges, filter])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Award or revoke badges for a user. Ledger-safe admin RPCs.
      </p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch()
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search username or display name"
          className={FOCUS_VISIBLE_RING}
          aria-label="Search users"
        />
        <Button
          type="submit"
          className={cn('gap-2', FOCUS_VISIBLE_RING)}
          disabled={searching}
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" aria-hidden />
          )}
          Search
        </Button>
      </form>

      {searchError ? (
        <AdminErrorState
          message={searchError}
          onRetry={
            searchErrorRetryable ? () => void runSearch() : undefined
          }
        />
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {results.map((user) => (
            <li key={user.user_id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/30',
                  FOCUS_VISIBLE_RING,
                )}
                onClick={() => {
                  setResults([])
                  setLoadError(null)
                  setSelected({
                    id: user.user_id,
                    display_name: user.display_name,
                    username: user.username,
                  })
                  void loadUser(user.user_id)
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {user.display_name || user.username || 'Player'}
                  </span>
                  {user.username ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      @{user.username}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-primary">Select</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      {loadError && selected ? (
        <AdminErrorState
          message={loadError}
          onRetry={() => void loadUser(selected.id)}
        />
      ) : null}

      {loadingUser ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : selected && !loadError ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-wide text-foreground">
                {selected.display_name || selected.username || 'Player'}
              </h2>
              {selected.username ? (
                <p className="text-sm text-muted-foreground">
                  @{selected.username}
                </p>
              ) : null}
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(['all', 'earned', 'missing'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs capitalize',
                    FOCUS_VISIBLE_RING,
                    filter === value
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {visible.map((badge) => {
              const rarity = achievementRarityLabel(badge.rarity)
              const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
              return (
                <li
                  key={badge.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5"
                >
                  <div className="h-12 w-12 shrink-0">
                    <AchievementBadgeArt
                      achievementId={badge.id}
                      artFilename={badge.art_filename}
                      src={badge.imageUrl}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {badge.name}
                      </p>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]',
                          rarityStyle.chip,
                        )}
                      >
                        {rarity}
                      </span>
                      {!badge.is_active ? (
                        <span className="text-[10px] text-muted-foreground">
                          retired
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {badge.id} · +{badge.xp_value} XP
                      {badge.earned
                        ? ` · earned ${badge.earned_at ?? ''}`
                        : ' · not earned'}
                    </p>
                  </div>
                  {badge.earned ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={FOCUS_VISIBLE_RING}
                      disabled={busyId === badge.id}
                      onClick={() => void mutate('revoke', badge.id)}
                    >
                      {busyId === badge.id ? '…' : 'Revoke'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className={FOCUS_VISIBLE_RING}
                      disabled={busyId === badge.id}
                      onClick={() => void mutate('award', badge.id)}
                    >
                      {busyId === badge.id ? '…' : 'Award'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
