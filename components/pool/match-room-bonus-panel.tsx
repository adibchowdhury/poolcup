'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClientNow } from '@/hooks/use-client-now'
import {
  BONUS_CATEGORIES,
  deriveLiveBonusAnswers,
  fetchMatchBonusPicks,
  fetchOwnBonusPicks,
  formatBonusAnswerLabel,
  type BonusCategory,
  type BonusCategoryId,
  type MatchBonusPick,
  upsertBonusPick,
} from '@/src/lib/bonus-predictions'
import { isMatchKickedOff } from '@/src/lib/match-lock'
import { supabase } from '@/src/lib/supabase'
import { UserProfileLink } from '@/components/user-profile-link'

type MatchRoomBonusPanelProps = {
  poolId: string
  memberId: string
  matchId: string
  currentUserId: string
  lockedAt: string | null
  kickoffAt: string
  isFinal: boolean
  resultTeam1: number | null
  resultTeam2: number | null
}

function ChipSegmentedOption({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border px-1.5 py-1 text-[10px] font-medium leading-tight transition-colors',
        selected
          ? 'border-primary bg-primary/15 text-foreground'
          : 'border-border/80 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  )
}

function BonusCategoryChip({
  category,
  hasKickedOff,
  isFinal,
  selectedAnswer,
  saving,
  isLocked,
  categoryPicks,
  yourPick,
  liveCurrent,
  onSelect,
}: {
  category: BonusCategory
  hasKickedOff: boolean
  isFinal: boolean
  selectedAnswer: string | undefined
  saving: boolean
  isLocked: boolean
  categoryPicks: MatchBonusPick[]
  yourPick: MatchBonusPick | undefined
  liveCurrent: string | null
  onSelect: (answer: string) => void
}) {
  const onTrack =
    hasKickedOff &&
    !isFinal &&
    yourPick != null &&
    liveCurrent != null &&
    yourPick.answer === liveCurrent

  const footerLabel = !hasKickedOff
    ? 'Lock at kickoff'
    : isFinal
      ? yourPick
        ? yourPick.pointsAwarded > 0
          ? `+${yourPick.pointsAwarded} pts`
          : '0 pts'
        : null
      : yourPick
        ? onTrack
          ? `On track · +${category.points} if it holds`
          : 'Off track'
        : null

  return (
    <article className="flex min-w-[9.75rem] max-w-full flex-col rounded-xl border border-border/80 bg-muted/20 p-2.5 sm:min-w-0 sm:flex-1">
      <div className="mb-2 flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {category.label}
        </p>
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-primary">
          +{category.points}
        </span>
      </div>

      <div className="min-h-[4.5rem] flex-1">
        {!hasKickedOff ? (
          <div className="flex flex-col gap-1">
            {category.options.map((option) => (
              <ChipSegmentedOption
                key={option.value}
                label={option.label}
                selected={selectedAnswer === option.value}
                disabled={isLocked || saving}
                onSelect={() => onSelect(option.value)}
              />
            ))}
          </div>
        ) : categoryPicks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No picks yet</p>
        ) : (
          <div className="space-y-1.5">
            {yourPick ? (
              <p className="text-xs font-semibold text-foreground">
                You: {formatBonusAnswerLabel(category.id, yourPick.answer)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">You: —</p>
            )}
            <ul className="max-h-[5.5rem] space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
              {categoryPicks.map((pick) => (
                <li
                  key={pick.memberId}
                  className="truncate text-[10px] leading-tight text-muted-foreground"
                >
                  <UserProfileLink
                    userId={pick.userId}
                    className="text-foreground/90 hover:underline"
                  >
                    {pick.displayName}
                  </UserProfileLink>
                  {': '}
                  {formatBonusAnswerLabel(category.id, pick.answer)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {footerLabel ? (
        <p
          className={cn(
            'mt-2 truncate text-[10px] font-medium leading-tight',
            onTrack
              ? 'text-primary'
              : isFinal && yourPick && yourPick.pointsAwarded > 0
                ? 'text-primary'
                : 'text-muted-foreground',
          )}
        >
          {footerLabel}
        </p>
      ) : null}
    </article>
  )
}

export function MatchRoomBonusPanel({
  poolId,
  memberId,
  matchId,
  currentUserId,
  lockedAt,
  kickoffAt,
  isFinal,
  resultTeam1,
  resultTeam2,
}: MatchRoomBonusPanelProps) {
  const { mounted, nowMs } = useClientNow(1_000)
  const hasKickedOff =
    mounted && isMatchKickedOff(lockedAt, kickoffAt, nowMs)
  const isLocked = hasKickedOff

  const [ownPicks, setOwnPicks] = useState<Map<BonusCategoryId, string>>(
    new Map(),
  )
  const [allPicks, setAllPicks] = useState<MatchBonusPick[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [savingCategory, setSavingCategory] = useState<BonusCategoryId | null>(
    null,
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  const liveAnswers = useMemo(
    () => deriveLiveBonusAnswers(resultTeam1, resultTeam2),
    [resultTeam1, resultTeam2],
  )

  const loadOwnPicks = useCallback(async () => {
    const result = await fetchOwnBonusPicks(
      supabase,
      poolId,
      matchId,
      memberId,
    )

    if (result.error) {
      setFetchError(result.error)
      setOwnPicks(new Map())
    } else {
      setOwnPicks(result.picksByCategory)
    }
  }, [poolId, matchId, memberId])

  const loadAllPicks = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const result = await fetchMatchBonusPicks(supabase, poolId, matchId)

    if (result.error) {
      setFetchError(result.error)
      setAllPicks([])
    } else {
      setAllPicks(result.picks)
    }

    setLoading(false)
  }, [poolId, matchId])

  useEffect(() => {
    if (!hasKickedOff) {
      setLoading(true)
      void loadOwnPicks().finally(() => setLoading(false))
      return
    }

    void loadAllPicks()
  }, [hasKickedOff, loadOwnPicks, loadAllPicks])

  useEffect(() => {
    if (!hasKickedOff) return

    const interval = window.setInterval(() => {
      void loadAllPicks()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [hasKickedOff, loadAllPicks])

  async function handleSelect(
    categoryId: BonusCategoryId,
    answer: string,
  ) {
    if (isLocked) return

    setSavingCategory(categoryId)
    setSaveError(null)

    const result = await upsertBonusPick(supabase, {
      poolId,
      memberId,
      matchId,
      categoryId,
      answer,
    })

    setSavingCategory(null)

    if (result.error) {
      setSaveError(result.error)
      return
    }

    setOwnPicks((prev) => {
      const next = new Map(prev)
      next.set(categoryId, answer)
      return next
    })
  }

  const picksByCategory = useMemo(() => {
    const map = new Map<BonusCategoryId, MatchBonusPick[]>()
    for (const category of BONUS_CATEGORIES) {
      map.set(category.id, [])
    }

    if (!allPicks) return map

    for (const pick of allPicks) {
      const list = map.get(pick.categoryId) ?? []
      list.push(pick)
      map.set(pick.categoryId, list)
    }

    for (const [, list] of map) {
      list.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        }),
      )
    }

    return map
  }, [allPicks])

  const yourPicksByCategory = useMemo(() => {
    const map = new Map<BonusCategoryId, MatchBonusPick>()
    if (!allPicks) return map

    for (const pick of allPicks) {
      if (pick.userId === currentUserId) {
        map.set(pick.categoryId, pick)
      }
    }

    return map
  }, [allPicks, currentUserId])

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h3 className="font-display text-lg tracking-wide text-foreground">
          Bonus Predictions
        </h3>
        {hasKickedOff && !isFinal ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
            <span
              className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
              aria-hidden
            />
            Live preview
          </span>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        {saveError ? (
          <p className="mb-3 text-center text-sm text-destructive">{saveError}</p>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading bonus picks…
          </p>
        ) : fetchError ? (
          <p className="py-4 text-center text-sm text-destructive">
            Could not load bonus picks.
          </p>
        ) : (
          <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {BONUS_CATEGORIES.map((category) => (
              <BonusCategoryChip
                key={category.id}
                category={category}
                hasKickedOff={hasKickedOff}
                isFinal={isFinal}
                selectedAnswer={ownPicks.get(category.id)}
                saving={savingCategory === category.id}
                isLocked={isLocked}
                categoryPicks={picksByCategory.get(category.id) ?? []}
                yourPick={
                  hasKickedOff
                    ? yourPicksByCategory.get(category.id)
                    : undefined
                }
                liveCurrent={liveAnswers?.[category.id] ?? null}
                onSelect={(answer) => void handleSelect(category.id, answer)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
