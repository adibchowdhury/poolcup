'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { xpToLevel } from '@/src/lib/levels'

/**
 * Landing-only presentational slice of ProfileShowcase.
 * Static example data — no auth, fetch, evaluate, or navigation.
 * Mirrors the redesigned hero (left avatar + name, XP bar)
 * plus a compact Featured Badges row.
 */

const EXAMPLE = {
  displayName: 'Alex Rivera',
  /** Generic preset avatar from /public/avatars. */
  avatarSrc: '/avatars/brown_skin_avatar.png',
  memberSince: 'Jan 2025',
  /** Level 8 (floor 4,000 → next 5,200) with a clear mid-bar fill. */
  totalXp: 4_750,
  badges: [
    {
      id: 'welcome',
      name: 'Welcome',
      xp: 50,
      src: '/badges/01_welcome_badge.png',
    },
    {
      id: 'first_steps',
      name: 'First Steps',
      xp: 100,
      src: '/badges/02_first_steps_badge.png',
    },
    {
      id: 'pool_party',
      name: 'Pool Party',
      xp: 250,
      src: '/badges/03_pool_party_badge.png',
    },
    {
      id: 'pool_host',
      name: 'Pool Host',
      xp: 400,
      src: '/badges/04_pool_host_badge.png',
    },
  ],
} as const

type BadgeRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

const RARITY_TEXT: Record<BadgeRarity, string> = {
  Common: 'text-slate-300',
  Rare: 'text-sky-300',
  Epic: 'text-purple-300',
  Legendary: 'text-amber-300',
}

function getRarity(xpValue: number): BadgeRarity {
  if (xpValue <= 50) return 'Common'
  if (xpValue <= 250) return 'Rare'
  if (xpValue <= 600) return 'Epic'
  return 'Legendary'
}

type LandingProfilePreviewProps = {
  /** Nest inside a feature card — drop outer chrome (parent provides glass frame). */
  embedded?: boolean
}

export function LandingProfilePreview({
  embedded = false,
}: LandingProfilePreviewProps) {
  const level = xpToLevel(EXAMPLE.totalXp)

  return (
    <div
      className={cn(
        'overflow-hidden bg-app-background',
        !embedded &&
          'rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
      )}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-md space-y-3 px-2.5 py-3 sm:px-3 sm:py-3.5">
        {/* Hero — mirrors redesigned ProfileShowcase */}
        <section className="hue-card-surface relative overflow-hidden rounded-[20px] border border-primary/15 bg-gradient-to-br from-[#080b0f] via-[#0c1410] to-primary/[0.06] shadow-[0_14px_36px_rgba(0,0,0,0.32)]">
          <div className="relative h-[88px] w-full sm:h-[96px]">
            <Image
              src="/background_01.png"
              alt=""
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width: 512px) 100vw, 420px"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.15)_0%,rgba(8,11,15,0.55)_45%,rgba(8,11,15,0.98)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,230,118,0.12),transparent_55%)]" />
          </div>

          <div className="relative px-3.5 pb-4 pt-1 sm:px-4 sm:pb-4.5">
            <div className="relative z-10 -mt-10 flex items-end gap-3.5 sm:-mt-11 sm:gap-4">
              <div className="relative h-[76px] w-[76px] shrink-0 sm:h-[84px] sm:w-[84px]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-[#0b1711] shadow-[0_10px_22px_rgba(0,0,0,0.45)] ring-2 ring-background">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static landing avatar */}
                  <img
                    src={EXAMPLE.avatarSrc}
                    alt=""
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate font-display text-[20px] leading-none tracking-wide text-foreground sm:text-[24px]">
                  {EXAMPLE.displayName}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground sm:text-[11px]">
                  Member since {EXAMPLE.memberSince}
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-sm tracking-wide text-foreground sm:text-base">
                  Level {level.level}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                  {EXAMPLE.totalXp.toLocaleString()}/
                  {level.nextLevelThreshold?.toLocaleString() ?? '—'} XP
                  {level.nextLevelThreshold != null
                    ? ` · ${level.xpToNext.toLocaleString()} to next`
                    : ' · Max'}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-border bg-muted">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.4)]"
                  style={{ width: `${level.progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tab chrome — visual only (Overview active) */}
        <div className="grid grid-cols-4 gap-0.5 rounded-xl border border-border/90 bg-card/90 p-1">
          {(['Overview', 'Progress', 'Achievements', 'Stats'] as const).map(
            (label, index) => (
              <div
                key={label}
                className={cn(
                  'min-w-0 rounded-lg px-1 py-1.5 text-center text-[9px] leading-tight sm:text-[10px]',
                  index === 0
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <span className="truncate">{label}</span>
              </div>
            ),
          )}
        </div>

        {/* Featured Badges — real badge art from /public/badges */}
        <div>
          <p className="mb-2 font-display text-base tracking-wide text-foreground sm:text-lg">
            Featured Badges
          </p>
          <div className="grid grid-cols-4 gap-x-2 gap-y-2">
            {EXAMPLE.badges.map((badge) => {
              const rarity = getRarity(badge.xp)
              return (
                <div
                  key={badge.id}
                  className="flex min-w-0 flex-col items-center text-center"
                >
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden sm:h-12 sm:w-12">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static landing badge art */}
                    <img
                      src={badge.src}
                      alt={badge.name}
                      className="block h-full w-full object-contain"
                    />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[8px] font-semibold leading-tight text-foreground sm:text-[9px]">
                    {badge.name}
                  </p>
                  <span
                    className={cn(
                      'mt-0.5 text-[7px] font-bold uppercase tracking-[0.08em]',
                      RARITY_TEXT[rarity],
                    )}
                  >
                    {rarity}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
