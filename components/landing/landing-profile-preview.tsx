'use client'

import {
  Award,
  CheckCircle2,
  Crown,
  Flame,
  Medal,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { cn } from '@/lib/utils'
import { xpToLevel } from '@/src/lib/levels'

/**
 * Landing-only presentational clone of ProfileShowcase’s hero + badges.
 * Static example data — no auth, fetch, evaluate, or navigation.
 * (ProfileShowcase itself always fetches global rank / achievements when active.)
 */

const EXAMPLE = {
  displayName: 'Alex Rivera',
  avatar: 'goal_keeper.png',
  totalXp: 9_100,
  globalRank: 1,
  totalRanked: 2_847,
  accuracy: 68,
  predictionsMade: 214,
  badgesEarned: 18,
  badges: [
    {
      id: 'welcome_aboard',
      name: 'Welcome Aboard',
      description: 'Joined PoolCup and set up your profile.',
      xp: 50,
    },
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Locked in your first prediction.',
      xp: 100,
    },
    {
      id: 'picture_perfect',
      name: 'Picture Perfect',
      description: 'Nailed an exact score.',
      xp: 250,
    },
  ],
  highlights: [
    { label: 'Highest Pool Finish', value: '#1', icon: Trophy, accent: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.07]' },
    { label: 'Longest Correct Streak', value: '9 straight', icon: Flame, accent: 'text-orange-300 border-orange-400/25 bg-orange-400/[0.07]' },
    { label: 'Pools Won', value: '4', icon: Crown, accent: 'text-purple-300 border-purple-400/25 bg-purple-400/[0.07]' },
    { label: 'Podium Finishes', value: '11', icon: Medal, accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.07]' },
  ],
} as const

type LandingProfilePreviewProps = {
  /** Nest inside a feature card — drop outer chrome (parent provides glass frame). */
  embedded?: boolean
}

export function LandingProfilePreview({
  embedded = false,
}: LandingProfilePreviewProps) {
  const level = xpToLevel(EXAMPLE.totalXp)
  const stats = [
    {
      label: 'Total XP',
      value: EXAMPLE.totalXp.toLocaleString(),
      icon: Zap,
      accent:
        'border-amber-400/25 bg-[linear-gradient(145deg,rgba(251,191,36,0.16),rgba(15,18,15,0.88))] text-amber-300',
    },
    {
      label: 'Accuracy',
      value: `${EXAMPLE.accuracy}%`,
      icon: TrendingUp,
      accent:
        'border-sky-400/25 bg-[linear-gradient(145deg,rgba(56,189,248,0.15),rgba(11,18,22,0.9))] text-sky-300',
    },
    {
      label: 'Badges',
      value: EXAMPLE.badgesEarned.toLocaleString(),
      icon: Award,
      accent:
        'border-purple-400/25 bg-[linear-gradient(145deg,rgba(192,132,252,0.15),rgba(17,13,22,0.9))] text-purple-300',
    },
    {
      label: 'Predictions Made',
      value: EXAMPLE.predictionsMade.toLocaleString(),
      icon: Target,
      accent:
        'border-primary/25 bg-[linear-gradient(145deg,rgba(0,230,118,0.15),rgba(9,20,14,0.9))] text-primary',
    },
  ] as const

  return (
    <div
      className={cn(
        'overflow-hidden',
        !embedded &&
          'rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
      )}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-md space-y-3 px-2.5 pb-3 pt-8 sm:px-3 sm:pb-4 sm:pt-9">
        {/* Hero — mirrors ProfileShowcase identity card */}
        <section className="relative rounded-[22px] border border-primary/18 bg-[radial-gradient(circle_at_50%_0%,rgba(0,230,118,0.16),transparent_48%),linear-gradient(155deg,rgba(20,38,29,0.97),rgba(8,17,13,0.99))] px-3 pb-3 pt-[78px] shadow-[0_18px_45px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.055)_inset]">
          <div className="absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-[38%]">
            <svg className="-rotate-90" viewBox="0 0 128 128" aria-hidden>
              <circle
                cx="64"
                cy="64"
                r="58"
                fill="rgba(8,17,13,0.98)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="5"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                fill="none"
                stroke="rgb(0,230,118)"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - level.progressPct}
                className="drop-shadow-[0_0_7px_rgba(0,230,118,0.65)]"
              />
            </svg>
            <div className="absolute inset-[13px] rounded-[19px] border border-primary/30 bg-[#0b1711] p-1 shadow-[0_10px_25px_rgba(0,0,0,0.35)]">
              <UserAvatarImage
                avatar={EXAMPLE.avatar}
                customAvatarUrl={null}
                className="h-full w-full rounded-[15px] border border-white/10"
                imgClassName="object-contain object-bottom p-0.5"
              />
            </div>
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full border border-primary/35 bg-[#102219] px-2 py-0.5 font-display text-xs text-primary shadow-[0_0_12px_rgba(0,230,118,0.28)]">
              {level.level}
            </span>
          </div>

          <div className="text-center">
            <p className="truncate font-display text-[25px] tracking-wide text-foreground">
              {EXAMPLE.displayName}
            </p>

            <div className="mt-3 flex justify-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(15,18,12,0.92))] px-3 py-1 shadow-[0_0_18px_rgba(251,191,36,0.18)]">
                <Crown className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                <span className="font-display text-sm tracking-wide text-amber-200">
                  Global Rank #{EXAMPLE.globalRank}
                </span>
                <span className="text-[10px] tabular-nums text-amber-200/65">
                  of {EXAMPLE.totalRanked.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mx-auto mt-4 max-w-[330px] text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg tracking-wide text-foreground">
                  Level {level.level}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {EXAMPLE.totalXp.toLocaleString()} /{' '}
                  {level.nextLevelThreshold?.toLocaleString() ?? '—'} XP
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-white/5 bg-black/55">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)]"
                  style={{ width: `${level.progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-[10px] font-medium text-primary/85">
                {level.xpToNext.toLocaleString()} XP to Level {level.level + 1}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-1.5">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className={cn(
                  'min-w-0 rounded-xl border px-1 py-2.5 text-center shadow-[0_8px_20px_rgba(0,0,0,0.16)]',
                  stat.accent,
                )}
              >
                <stat.icon className="mx-auto h-3.5 w-3.5" aria-hidden />
                <p className="mt-1 truncate font-display text-base leading-none tabular-nums text-foreground sm:text-lg">
                  {stat.value}
                </p>
                <p className="mt-1 truncate text-[7px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:text-[8px]">
                  {stat.label}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Badge rows */}
        <div className="space-y-2 px-0.5">
          {EXAMPLE.badges.map((badge) => (
            <article
              key={badge.id}
              className="flex items-center gap-3 rounded-[13px] border border-sky-400/35 bg-[#0c1712]/80 p-2.5 shadow-[0_0_20px_rgba(56,189,248,0.08)]"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 p-0.5">
                <AchievementBadgeArt
                  achievementId={badge.id}
                  alt={badge.name}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {badge.name}
                  </p>
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    aria-hidden
                  />
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                  {badge.description}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-primary">
                +{badge.xp} XP
              </span>
            </article>
          ))}
        </div>

        {/* Career highlights — matches reworded landing bullet */}
        <div className="grid grid-cols-2 gap-2 px-0.5">
          {EXAMPLE.highlights.map((highlight) => (
            <article
              key={highlight.label}
              className={cn(
                'rounded-[13px] border p-2.5',
                highlight.accent,
              )}
            >
              <highlight.icon className="h-3.5 w-3.5" aria-hidden />
              <p className="mt-1.5 font-display text-lg leading-none text-foreground">
                {highlight.value}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.06em] text-muted-foreground">
                {highlight.label}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
