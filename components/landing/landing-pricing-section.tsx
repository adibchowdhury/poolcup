'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIGNUP_HREF = '/login?next=/create'

type FreeHighlight = {
  icon: string
  label: string
  motion: 'ball' | 'trophy' | 'chat' | 'badge' | 'friends' | 'pools'
}

const FREE_HIGHLIGHTS: FreeHighlight[] = [
  { icon: '⚽', label: 'Predictions', motion: 'ball' },
  { icon: '🏆', label: 'Leaderboards', motion: 'trophy' },
  { icon: '💬', label: 'Pool Chat', motion: 'chat' },
  { icon: '🎖️', label: 'Badges', motion: 'badge' },
  { icon: '👥', label: 'Friends', motion: 'friends' },
  { icon: '🏟️', label: 'Pools', motion: 'pools' },
]

type UpgradeTier = {
  id: 'pro' | 'commissioner'
  name: string
  valueLine: string
  price: string
  audience: string
  ctaLabel: string
  highlights: { icon: string; label: string }[]
  expandedExtras: string[]
}

const UPGRADES: UpgradeTier[] = [
  {
    id: 'pro',
    name: 'PoolCup Pro',
    valueLine: 'Compete smarter.',
    price: '$4.99/month',
    audience: 'For superfans.',
    ctaLabel: 'Go Pro',
    highlights: [
      { icon: '📈', label: 'Match insights' },
      { icon: '📊', label: 'Prediction trends' },
      { icon: '🎨', label: 'Custom profile & themes' },
      { icon: '🏅', label: 'Exclusive badges' },
    ],
    expandedExtras: [
      'Advanced analytics',
      'Prediction history',
      'AI insights',
      'Win probability',
      'Historical performance',
      'Exclusive tournaments',
    ],
  },
  {
    id: 'commissioner',
    name: 'Pool Commissioner',
    valueLine: 'Run your own tournament.',
    price: '$9.99/month',
    audience: 'Perfect for leagues & organizations.',
    ctaLabel: 'Become a Commissioner',
    highlights: [
      { icon: '♾️', label: 'Unlimited pools' },
      { icon: '⚙️', label: 'Admin controls & custom scoring' },
      { icon: '📢', label: 'Announcements & polls' },
      { icon: '🎨', label: 'Team branding' },
    ],
    expandedExtras: [
      'Money pool tracking',
      'Scheduling',
      'Export results',
      'Admin tools',
    ],
  },
]

const COMPARISON_ROWS: {
  feature: string
  free: boolean
  pro: boolean
  commissioner: boolean
}[] = [
  { feature: 'Predictions & leaderboards', free: true, pro: true, commissioner: true },
  { feature: 'Friends & pool chat', free: true, pro: true, commissioner: true },
  { feature: 'Badges & multi-sport', free: true, pro: true, commissioner: true },
  { feature: 'Advanced analytics & AI insights', free: false, pro: true, commissioner: true },
  { feature: 'Custom profile & premium badges', free: false, pro: true, commissioner: true },
  { feature: 'Unlimited custom pools', free: false, pro: true, commissioner: true },
  { feature: 'Admin tools & custom scoring', free: false, pro: false, commissioner: true },
  { feature: 'Announcements, polls & branding', free: false, pro: false, commissioner: true },
  { feature: 'Money pool tracking & exports', free: false, pro: false, commissioner: true },
]

const PILL_MOTION_CLASS: Record<FreeHighlight['motion'], string> = {
  ball: 'group-hover:animate-[pricing-ball-spin_0.7s_ease-out] group-active:animate-[pricing-ball-spin_0.7s_ease-out]',
  trophy:
    'group-hover:animate-[pricing-trophy-shine_0.85s_ease-out] group-active:animate-[pricing-trophy-shine_0.85s_ease-out]',
  chat: 'group-hover:animate-[pricing-chat-bounce_0.55s_ease-out] group-active:animate-[pricing-chat-bounce_0.55s_ease-out]',
  badge:
    'group-hover:animate-[pricing-badge-pop_0.55s_ease-out] group-active:animate-[pricing-badge-pop_0.55s_ease-out]',
  friends:
    'group-hover:animate-[pricing-friends-nudge_0.55s_ease-out] group-active:animate-[pricing-friends-nudge_0.55s_ease-out]',
  pools:
    'group-hover:animate-[pricing-pools-pulse_0.7s_ease-out] group-active:animate-[pricing-pools-pulse_0.7s_ease-out]',
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return reduced
}

/** Small aspirational accent — emoji/CSS only (no mascot asset in /public). */
function UpgradeAccent({ kind }: { kind: 'pro' | 'commissioner' }) {
  if (kind === 'pro') {
    return (
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center"
        aria-hidden
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.35)_0%,transparent_70%)] blur-[2px]" />
        <span className="relative text-[1.65rem] drop-shadow-[0_0_10px_rgba(255,193,7,0.55)]">
          🏆
        </span>
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 text-[10px] opacity-90 animate-[pricing-sparkle_2.4s_ease-in-out_infinite] motion-reduce:animate-none">
          ✨
        </span>
      </div>
    )
  }

  return (
    <div
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,230,118,0.22)_0%,transparent_70%)]" />
      <span className="relative text-[1.55rem]">📣</span>
      <span className="pointer-events-none absolute -bottom-0.5 -right-1 text-sm">
        📋
      </span>
    </div>
  )
}

function UpgradeCard({
  tier,
  open,
  onToggle,
  reducedMotion,
}: {
  tier: UpgradeTier
  open: boolean
  onToggle: () => void
  reducedMotion: boolean
}) {
  const panelId = useId()
  const triggerId = useId()

  return (
    <div
      className={cn(
        'rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0f1620]',
        'transition-[transform,box-shadow,border-color] duration-200',
        !reducedMotion &&
          'hover:-translate-y-0.5 hover:border-[#00e676]/35 hover:shadow-[0_12px_32px_rgba(0,230,118,0.1)]',
        open && 'border-[#00e676]/30',
      )}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl px-4 py-4 text-left sm:px-5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1620]',
        )}
      >
        <UpgradeAccent kind={tier.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-lg tracking-wide text-[#f0f4f8]">
              {tier.name}
            </span>
            <span className="font-mono text-sm font-semibold text-[#00e676]">
              {tier.price}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-[#f0f4f8]/90">
            {tier.valueLine}
          </p>
          <p className="mt-1 text-xs text-[#5a7080]">{tier.audience}</p>
          <p className="mt-2 text-[11px] font-medium text-[#728d9c]">
            Tap to see everything included
          </p>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-5 w-5 shrink-0 text-[#728d9c] transition-transform duration-200',
            open && 'rotate-180 text-[#00e676]',
            !open &&
              !reducedMotion &&
              'animate-[pricing-chevron-nudge_3.2s_ease-in-out_infinite]',
            reducedMotion && 'transition-none animate-none',
          )}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="border-t border-[rgba(255,255,255,0.08)] px-4 pb-5 pt-3 sm:px-5"
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tier.highlights.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2 text-sm text-[#f0f4f8]/90"
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>

        <ul className="mt-3 space-y-1.5 border-t border-[rgba(255,255,255,0.06)] pt-3">
          {tier.expandedExtras.map((extra) => (
            <li
              key={extra}
              className="flex items-start gap-2 text-xs text-[#728d9c]"
            >
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00e676]"
                aria-hidden
                strokeWidth={2.5}
              />
              <span>{extra}</span>
            </li>
          ))}
        </ul>

        {/*
          TODO(billing): Wire this CTA to the real Pro / Commissioner
          Stripe subscription checkout once billing exists.
        */}
        <Link
          href={SIGNUP_HREF}
          className={cn(
            'mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold',
            'border border-[#00e676]/40 text-[#00e676] transition-colors hover:bg-[#00e676]/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1620]',
            !reducedMotion && 'hover:shadow-[0_0_20px_rgba(0,230,118,0.15)]',
          )}
        >
          {tier.ctaLabel}
        </Link>
      </div>
    </div>
  )
}

function ComparisonCell({ included }: { included: boolean }) {
  return included ? (
    <Check
      className="mx-auto h-4 w-4 text-[#00e676]"
      aria-label="Included"
      strokeWidth={2.5}
    />
  ) : (
    <Minus
      className="mx-auto h-4 w-4 text-[#5a7080]/50"
      aria-label="Not included"
    />
  )
}

export function LandingPricingSection() {
  const reducedMotion = usePrefersReducedMotion()
  const [openUpgrade, setOpenUpgrade] = useState<'pro' | 'commissioner' | null>(
    null,
  )
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const comparisonId = useId()
  const comparisonTriggerId = useId()

  return (
    <section
      id="pricing"
      className="bg-background py-20 md:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-heading"
            className="font-display text-4xl tracking-wide text-[#f0f4f8] md:text-5xl"
          >
            Free Forever. Upgrade When You&apos;re Ready.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#728d9c] md:text-lg">
            Predict matches, compete with friends, and join public pools at no
            cost.
          </p>
        </div>

        {/* Vertical flow: Free → level up → Pro/Commissioner → comparison */}
        <div className="mx-auto mt-10 max-w-xl sm:mt-12">
          <article className="overflow-hidden rounded-2xl border border-[#00e676]/20 bg-gradient-to-br from-[#0c1410] via-[#121c28] to-[#0a0f14] p-6 shadow-[0_8px_24px_rgba(0,230,118,0.03)] sm:p-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                ⚽
              </span>
              <h3 className="font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl">
                Free
              </h3>
            </div>
            <p className="mt-1 font-display text-4xl tracking-wide text-[#00e676] md:text-5xl">
              $0
            </p>
            <p className="mt-2 text-sm text-[#728d9c] md:text-base">
              Everything you need to play.
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FREE_HIGHLIGHTS.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-left text-sm font-medium text-[#f0f4f8]',
                      'transition-colors hover:border-[#00e676]/25 hover:bg-[rgba(0,230,118,0.06)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex text-base leading-none',
                        !reducedMotion && PILL_MOTION_CLASS[item.motion],
                      )}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div
              className="my-6 h-px w-full bg-[rgba(255,255,255,0.08)]"
              aria-hidden
            />

            <div className="space-y-1.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm text-[#f0f4f8]/85">
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[#00e676]"
                  aria-hidden
                  strokeWidth={2.5}
                />
                <span>No credit card required</span>
              </p>
              <p className="text-sm text-[#728d9c]">
                1,700+ players joined during the World Cup
              </p>
            </div>

            <Link
              href={SIGNUP_HREF}
              className={cn(
                'mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#00e676] px-6 text-base font-semibold text-[#080b0f]',
                'shadow-[0_0_28px_rgba(0,230,118,0.35)] transition-[background-color,box-shadow] hover:bg-[#00e676]/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121c28]',
                !reducedMotion &&
                  'hover:shadow-[0_0_40px_rgba(0,230,118,0.5)]',
                reducedMotion && 'shadow-[0_0_16px_rgba(0,230,118,0.22)]',
              )}
            >
              Start Playing
            </Link>
            <p className="mt-2.5 text-center text-xs text-[#5a7080]">
              Most players start here.
            </p>
          </article>
        </div>

        <div className="mt-14 text-center sm:mt-16">
          <h3 className="font-display text-2xl tracking-wide text-[#f0f4f8] sm:text-3xl">
            Ready to level up?
          </h3>
          <p className="mt-2 text-sm text-[#5a7080]">
            Optional upgrades — expand a plan to see what&apos;s included.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
          {UPGRADES.map((tier) => (
            <UpgradeCard
              key={tier.id}
              tier={tier}
              open={openUpgrade === tier.id}
              reducedMotion={reducedMotion}
              onToggle={() =>
                setOpenUpgrade((current) =>
                  current === tier.id ? null : tier.id,
                )
              }
            />
          ))}
        </div>

        {/* —— Optional comparison —— */}
        <div className="mt-12 text-center sm:mt-14">
          <button
            type="button"
            id={comparisonTriggerId}
            aria-expanded={comparisonOpen}
            aria-controls={comparisonId}
            onClick={() => setComparisonOpen((open) => !open)}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium text-[#728d9c] transition-colors hover:text-[#00e676]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            View full comparison
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                comparisonOpen && 'rotate-180',
                reducedMotion && 'transition-none',
              )}
              aria-hidden
            />
          </button>

          <div
            id={comparisonId}
            role="region"
            aria-labelledby={comparisonTriggerId}
            hidden={!comparisonOpen}
            className="mt-5 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121c28] text-left"
          >
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#728d9c]">
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  <th className="px-3 py-3 text-center font-medium">Free</th>
                  <th className="px-3 py-3 text-center font-medium">Pro</th>
                  <th className="px-3 py-3 text-center font-medium">
                    Commissioner
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                  >
                    <td className="px-4 py-2.5 text-[#f0f4f8]/90">
                      {row.feature}
                    </td>
                    <td className="px-3 py-2.5">
                      <ComparisonCell included={row.free} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ComparisonCell included={row.pro} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ComparisonCell included={row.commissioner} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
