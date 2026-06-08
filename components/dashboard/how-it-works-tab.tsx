'use client'

import {
  Check,
  Lock,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { POOL_SCORING_STYLE_OPTIONS } from '@/src/lib/scoring-style-display'

const SCORING_STYLE_UI = [
  {
    ...POOL_SCORING_STYLE_OPTIONS[0],
    accent: 'border-[#22c55e]/30 bg-[#22c55e]/5',
    iconColor: 'text-[#22c55e]',
    iconBg: 'bg-[#22c55e]/15',
    icon: Zap,
  },
  {
    ...POOL_SCORING_STYLE_OPTIONS[1],
    accent: 'border-[#3b82f6]/30 bg-[#3b82f6]/5',
    iconColor: 'text-[#3b82f6]',
    iconBg: 'bg-[#3b82f6]/15',
    icon: Target,
  },
] as const

const XP_LEVELS = [
  { level: 1, title: 'Benchwarmer', minXp: 0 },
  { level: 2, title: 'Kickabout', minXp: 100 },
  { level: 3, title: 'Pitch Rat', minXp: 300 },
  { level: 4, title: "Scout's Eye", minXp: 600 },
  { level: 5, title: 'Hat Trick Hero', minXp: 1_000 },
  { level: 6, title: 'Playmaker', minXp: 1_500 },
  { level: 7, title: 'Golden Boot', minXp: 2_100 },
  { level: 8, title: 'Top of the Table', minXp: 3_000 },
  { level: 9, title: 'Extra Time', minXp: 4_000 },
  { level: 10, title: 'The GOAT', minXp: 5_000 },
] as const

const XP_REWARDS = [
  { label: 'Making predictions before kickoff', xp: 5, suffix: 'per match predicted' },
  { label: 'Correct winner prediction', xp: 10 },
  { label: 'Exact score prediction', xp: 25 },
  { label: 'Completing all predictions for a matchday', xp: 50, suffix: 'bonus' },
] as const

function formatXp(value: number): string {
  return value.toLocaleString()
}

function getLevelProgress(
  index: number,
  currentXp: number,
): { progressPercent: number; isUnlocked: boolean; isCurrent: boolean } {
  const level = XP_LEVELS[index]!
  const next = XP_LEVELS[index + 1]
  const isUnlocked = currentXp >= level.minXp

  if (!next) {
    return {
      progressPercent: isUnlocked ? 100 : 0,
      isUnlocked,
      isCurrent: isUnlocked,
    }
  }

  if (currentXp >= next.minXp) {
    return { progressPercent: 100, isUnlocked: true, isCurrent: false }
  }

  if (currentXp < level.minXp) {
    return { progressPercent: 0, isUnlocked: false, isCurrent: false }
  }

  const span = next.minXp - level.minXp
  const progressPercent =
    span > 0 ? Math.min(100, ((currentXp - level.minXp) / span) * 100) : 100

  return { progressPercent, isUnlocked: true, isCurrent: true }
}

type HowItWorksTabProps = {
  currentXp?: number
}

export function HowItWorksTab({ currentXp = 0 }: HowItWorksTabProps) {
  const xp = Math.max(0, currentXp)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-12">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-[#ffb300]" />
          <div>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              How Scoring Works
            </h2>
            <p className="text-sm text-muted-foreground">
              Each pool uses one scoring style — pick what fits your group
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SCORING_STYLE_UI.map((style) => {
            const Icon = style.icon
            return (
              <article
                key={style.id}
                className={cn(
                  'rounded-2xl border p-5 transition-colors',
                  style.accent,
                )}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      style.iconBg,
                    )}
                  >
                    <Icon className={cn('h-5 w-5', style.iconColor)} />
                  </div>
                  <h3 className="font-display text-xl tracking-wide text-foreground">
                    {style.label}
                  </h3>
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  {style.rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', style.iconBg)} />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>

                <p className={cn('mt-4 text-xs font-medium', style.iconColor)}>
                  {style.tagline}
                </p>
              </article>
            )
          })}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#ffb300]/25 bg-[#ffb300]/5 px-4 py-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb300]" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Knockout rounds:</span>{' '}
            points are doubled in the Round of 32 through the Final — exact scores
            and correct winners earn twice as much.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              XP, Levels &amp; Badges
            </h2>
            <p className="text-sm text-muted-foreground">
              Earn XP across all pools to climb the ranks on your profile
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            How you earn XP
          </h3>
          <ul className="mt-4 space-y-3">
            {XP_REWARDS.map((reward) => (
              <li
                key={reward.label}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-muted-foreground">{reward.label}</span>
                <span className="shrink-0 font-mono text-sm font-medium text-primary">
                  +{reward.xp} XP{reward.suffix ? ` ${reward.suffix}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            All 10 levels
          </h3>
          <ul className="space-y-2">
            {XP_LEVELS.map((level, index) => {
              const { progressPercent, isUnlocked, isCurrent } = getLevelProgress(
                index,
                xp,
              )

              return (
                <li
                  key={level.level}
                  className={cn(
                    'rounded-xl border px-4 py-3 transition-colors',
                    isCurrent
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-card/30',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        isUnlocked
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isUnlocked ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium text-foreground">
                          <span className="text-muted-foreground">
                            {level.level}.
                          </span>{' '}
                          {level.title}
                        </p>
                        <p className="shrink-0 font-mono text-xs text-muted-foreground">
                          {formatXp(level.minXp)} XP
                        </p>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isUnlocked ? 'bg-primary' : 'bg-transparent',
                          )}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
