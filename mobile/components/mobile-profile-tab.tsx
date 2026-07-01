'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { ChevronDown, Pencil, Target, TrendingUp, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarSrc, resolveAvatarFilename } from '@/src/lib/avatars'
import {
  formatPointsDelta,
  formatRelativeTimestamp,
  getPointsTransactionDescription,
  type PointsTransactionRow,
} from '@/src/lib/points-transaction-feed'
import { MOBILE_AVATAR_FILENAMES } from '../lib/mobile-avatar-options'
import {
  fetchPointsTransactions,
  fetchUserProfile,
} from '../lib/fetch-profile-data'
import { fetchProfileQuickStats } from '../lib/fetch-profile-quick-stats'
import { buildProfileSportsEntries } from '../lib/profile-sports-display'
import { supabase } from '../lib/supabase-mobile'
import { useLiveTotalPoints } from '../lib/use-live-total-points'

type MobileProfileTabProps = {
  pools: DashboardPoolCardData[]
  poolsLoading: boolean
}

function StatPlaceholder() {
  return (
    <span className="inline-block h-9 w-12 animate-pulse rounded bg-muted/40" />
  )
}

export function MobileProfileTab({
  pools,
  poolsLoading,
}: MobileProfileTabProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    resolveAvatarFilename(null),
  )
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<PointsTransactionRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [quickStatsLoading, setQuickStatsLoading] = useState(true)
  const [quickStatsError, setQuickStatsError] = useState<string | null>(null)
  const [predictionsMade, setPredictionsMade] = useState<number | null>(null)
  const [winRate, setWinRate] = useState<number | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState<string | null>(null)

  const { formattedPoints, loading: pointsLoading } = useLiveTotalPoints(
    userId,
    Boolean(userId),
  )

  const canSaveDisplayName = useMemo(() => Boolean(editName.trim()), [editName])

  const sportsEntries = useMemo(
    () => buildProfileSportsEntries(pools),
    [pools],
  )

  const loadQuickStats = useCallback(async (uid: string) => {
    setQuickStatsLoading(true)
    setQuickStatsError(null)

    const { stats, error } = await fetchProfileQuickStats(supabase, uid)

    if (error) {
      setQuickStatsError(error)
      setPredictionsMade(null)
      setWinRate(null)
    } else {
      setPredictionsMade(stats.predictionsMade)
      setWinRate(stats.winRate)
    }

    setQuickStatsLoading(false)
  }, [])

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    setProfileError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setProfileError(userError?.message ?? 'Could not load your account')
      setProfileLoading(false)
      return
    }

    setUserId(user.id)

    const { profile, error } = await fetchUserProfile(supabase, user.id)

    if (error) {
      setProfileError(error)
    } else {
      const name = profile?.display_name?.trim() ?? ''
      setDisplayName(name)
      setEditName(name)
      setSelectedAvatar(resolveAvatarFilename(profile?.avatar))
    }

    setProfileLoading(false)
  }, [])

  const loadHistory = useCallback(async (uid: string) => {
    setHistoryLoading(true)
    setHistoryError(null)

    const { transactions: rows, error } = await fetchPointsTransactions(
      supabase,
      uid,
    )

    if (error) {
      setHistoryError(error)
      setTransactions([])
    } else {
      setTransactions(rows)
    }

    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!userId) return
    void loadHistory(userId)
    void loadQuickStats(userId)
  }, [userId, loadHistory, loadQuickStats])

  function openEditProfile() {
    setEditName(displayName)
    setEditMessage(null)
    setEditOpen(true)
  }

  function closeEditProfile() {
    setEditOpen(false)
    setEditMessage(null)
  }

  async function handleSelectAvatar(filename: string) {
    if (!userId || filename === selectedAvatar || avatarSaving) return

    const previous = selectedAvatar
    setAvatarSaving(filename)
    setSelectedAvatar(filename)

    const { error } = await supabase
      .from('users')
      .update({ avatar: filename })
      .eq('id', userId)

    setAvatarSaving(null)

    if (error) {
      setSelectedAvatar(previous)
      setEditMessage(error.message)
    }
  }

  async function handleSaveDisplayName() {
    if (!userId || !canSaveDisplayName) return

    setNameSaving(true)
    setEditMessage(null)

    const trimmed = editName.trim()
    const { error } = await supabase
      .from('users')
      .update({ display_name: trimmed })
      .eq('id', userId)

    setNameSaving(false)

    if (error) {
      setEditMessage(error.message)
      return
    }

    setDisplayName(trimmed)
    setEditMessage('Saved.')
  }

  if (profileLoading) {
    return (
      <div
        className="flex flex-1 flex-col px-4 py-6"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-40 w-32 animate-pulse rounded-2xl bg-muted/40" />
            <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
          </div>
          <div className="h-20 animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <p className="text-sm text-destructive" role="alert">
          {profileError}
        </p>
      </div>
    )
  }

  const shownName = displayName.trim() || 'Player'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <section className="flex flex-col items-center text-center">
          <img
            src={getAvatarSrc(selectedAvatar)}
            alt=""
            className="h-48 w-auto max-w-full object-contain object-bottom"
          />
          <h2 className="mt-4 font-display text-4xl tracking-wide text-foreground">
            {shownName}
          </h2>
          <button
            type="button"
            onClick={openEditProfile}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card/50 px-3 py-4 text-center">
            <Zap
              className="mx-auto h-5 w-5 text-primary"
              aria-hidden
            />
            <p
              className="mt-2 font-display text-2xl leading-none text-foreground"
              aria-busy={pointsLoading}
            >
              {pointsLoading ? <StatPlaceholder /> : formattedPoints}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Total Points
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 px-3 py-4 text-center">
            <Target
              className="mx-auto h-5 w-5 text-[#ffb300]"
              aria-hidden
            />
            <p
              className="mt-2 font-display text-2xl leading-none text-foreground"
              aria-busy={quickStatsLoading}
            >
              {quickStatsLoading ? (
                <StatPlaceholder />
              ) : predictionsMade !== null ? (
                predictionsMade.toLocaleString()
              ) : (
                '—'
              )}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Predictions Made
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 px-3 py-4 text-center">
            <TrendingUp
              className="mx-auto h-5 w-5 text-primary"
              aria-hidden
            />
            <p
              className="mt-2 font-display text-2xl leading-none text-foreground"
              aria-busy={quickStatsLoading}
            >
              {quickStatsLoading ? (
                <StatPlaceholder />
              ) : winRate != null ? (
                `${winRate}%`
              ) : (
                '—'
              )}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Win Rate</p>
          </div>
        </section>

        {quickStatsError ? (
          <p className="text-center text-xs text-destructive" role="alert">
            {quickStatsError}
          </p>
        ) : null}

        <section>
          <h3 className="font-display text-2xl tracking-wide text-foreground">
            Your Pools
          </h3>
          {poolsLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading pools…</p>
          ) : pools.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              You are not in any pools yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pools.map((pool) => (
                <li
                  key={pool.id}
                  className="rounded-xl border border-border/90 bg-card/90 px-4 py-3"
                >
                  <p className="font-medium text-foreground">{pool.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pool.eventName} · {pool.members}{' '}
                    {pool.members === 1 ? 'player' : 'players'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-2xl tracking-wide text-foreground">
              Sports you follow
            </h3>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Design mock — only Soccer is derived from your pools today.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sportsEntries.map((sport) => (
              <li
                key={sport.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  sport.derivedFromPools
                    ? 'border-border bg-card/80 text-foreground'
                    : 'border-dashed border-border/70 bg-muted/20 text-muted-foreground',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sport.iconSrc}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
                <span>{sport.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setHistoryExpanded((open) => !open)}
            aria-expanded={historyExpanded}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <h3 className="font-display text-2xl tracking-wide text-foreground">
              Points history
            </h3>
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                historyExpanded && 'rotate-180',
              )}
              aria-hidden
            />
          </button>

          {historyExpanded ? (
            <>
              {historyLoading && transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : historyError ? (
                <p
                  className="py-8 text-center text-sm text-destructive"
                  role="alert"
                >
                  {historyError}
                </p>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Your glory story starts here 🏆
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border/50 rounded-xl border border-border/90 bg-card/40 px-4">
                  {transactions.map((tx) => {
                    const description = getPointsTransactionDescription(
                      tx.reason,
                    )
                    return (
                      <li
                        key={tx.id}
                        className="flex items-start gap-3 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatRelativeTimestamp(tx.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-primary">
                          {formatPointsDelta(tx.points)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : null}
        </section>
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 pb-[calc(1rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]"
          role="presentation"
          onClick={closeEditProfile}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            role="dialog"
            aria-labelledby="mobile-edit-profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h4
                  id="mobile-edit-profile-title"
                  className="font-display text-2xl tracking-wide text-foreground"
                >
                  Edit profile
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update how you appear in pools and on your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditProfile}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label="Close edit profile"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="mobile-edit-profile-name"
                  className="mb-2 block text-sm font-medium text-muted-foreground"
                >
                  Display name
                </label>
                <input
                  id="mobile-edit-profile-name"
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                />
              </div>

              <div>
                <h5 className="font-display text-xl tracking-wide text-foreground">
                  Choose Your Avatar
                </h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a character for your profile. Changes save instantly.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {MOBILE_AVATAR_FILENAMES.map((filename) => {
                    const isSelected = selectedAvatar === filename
                    const isSaving = avatarSaving === filename
                    const avatarLabel = filename.replace(/\.[^.]+$/, '')

                    return (
                      <button
                        key={filename}
                        type="button"
                        onClick={() => void handleSelectAvatar(filename)}
                        disabled={Boolean(avatarSaving)}
                        aria-pressed={isSelected}
                        aria-label={`Select ${avatarLabel} avatar`}
                        className={cn(
                          'rounded-lg border-2 bg-muted/20 p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-border hover:border-muted-foreground/50',
                        )}
                      >
                        <img
                          src={getAvatarSrc(filename)}
                          alt=""
                          className="mx-auto h-20 w-20 object-contain"
                        />
                        {isSaving ? (
                          <span className="sr-only">Saving…</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {editMessage ? (
                  <p className="text-sm text-muted-foreground">{editMessage}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSaveDisplayName()}
                  disabled={nameSaving || !canSaveDisplayName}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {nameSaving ? 'Saving…' : 'Save name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
