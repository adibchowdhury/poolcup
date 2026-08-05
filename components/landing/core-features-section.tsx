import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { LandingLeaderboardPreview } from '@/components/landing/landing-leaderboard-preview'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'
import { cn } from '@/lib/utils'

type CoreFeature = {
  number: string
  /** Category label after "FEATURE ·" (e.g. PREDICTION POOLS). */
  category: string
  title: string
  description: string
  bullets: string[]
  /** Section accent (card glow + number box + underline + checkmarks). */
  cardGlow: string
  cardGlowRgb: string
}

const CORE_FEATURES: CoreFeature[] = [
  {
    number: '01',
    category: 'Prediction Pools',
    title: 'Create your pool. Invite your crew.',
    description:
      'Spin up a prediction pool for any competition, invite friends with a link, and predict every match. Winner-takes-bragging-rights.',
    bullets: [
      'Create or join unlimited pools',
      'Predict scores before kickoff',
      'Public pools or private squads',
      'Works across every league',
    ],
    cardGlow: '#00e676',
    cardGlowRgb: '0,230,118',
  },
  {
    number: '02',
    category: 'Live Leaderboards',
    title: 'Watch the standings shake.',
    description:
      'The leaderboard updates the moment a match ends — no spreadsheets, no arguments. Climb the ranks and prove you called it.',
    bullets: [
      'Updates instantly after each match',
      "Movement arrows show who's climbing",
      'Fire streaks for hot runs',
      'Shareable with the whole group',
    ],
    cardGlow: '#F5A623',
    cardGlowRgb: '245,166,35',
  },
  {
    number: '03',
    category: 'Squad Identity & Customization',
    title: 'Make it YOUR squad.',
    description:
      'Name your squad, pick your colors, add your emblem, and even set your own scoring rules. No other prediction app lets you make it truly yours.',
    bullets: [
      'Custom squad name, colors & emblem',
      'Set your own scoring rules',
      'Commissioner admin tools',
      'Announcements & team branding',
    ],
    cardGlow: '#8B5CF6',
    cardGlowRgb: '139,92,246',
  },
  {
    number: '04',
    category: 'Sports Identity & Progression',
    title: 'Build your sports identity.',
    description:
      'Every prediction builds your record. Earn XP, level up, unlock badges, and climb the global rank as you prove yourself across every match.',
    bullets: [
      'XP, levels & a global rank',
      'Unlockable badges & achievements',
      'Full prediction history & stats',
      'Your identity follows you everywhere',
    ],
    cardGlow: '#3B82F6',
    cardGlowRgb: '59,130,246',
  },
  {
    number: '05',
    category: 'Social & Community',
    title: 'Better with friends.',
    description:
      'Add friends, see how you stack up, talk trash in pool chat, and DM your rivals. PoolCup is a game you play with people.',
    bullets: [
      'Add friends & compare on the friends leaderboard',
      'Real-time pool chat',
      'Direct messages with friends',
      "See your friends' activity",
    ],
    cardGlow: '#EC4899',
    cardGlowRgb: '236,72,153',
  },
]

function FeatureCardShell({
  glowRgb,
  children,
}: {
  glow: string
  glowRgb: string
  children?: ReactNode
}) {
  const hasContent = Boolean(children)

  return (
    // Soft accent glow sits behind the whole layered card
    <div
      className="relative w-full"
      style={{
        filter: [
          `drop-shadow(0 0 40px rgba(${glowRgb},0.22))`,
          `drop-shadow(0 0 90px rgba(${glowRgb},0.14))`,
          `drop-shadow(0 0 160px rgba(${glowRgb},0.08))`,
        ].join(' '),
      }}
    >
      {/* Outer translucent glass frame / bezel */}
      <div
        className="rounded-[1.35rem] p-[5px] sm:p-1.5"
        style={{
          border: '1px solid rgba(255,255,255,0.28)',
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.01) 50%, rgba(255,255,255,0.025) 100%)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.18)',
            'inset 0 0 0 1px rgba(255,255,255,0.06)',
            '0 12px 40px rgba(0,0,0,0.35)',
          ].join(', '),
          backdropFilter: 'blur(14px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.15)',
        }}
      >
        {/* Inner dark card — gap from outer frame via parent padding */}
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-[1.05rem] bg-[#151c26]',
            !hasContent &&
              'flex min-h-[20rem] items-center justify-center sm:min-h-[24rem]',
          )}
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {!hasContent ? (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 70% 55% at 50% 40%, rgba(${glowRgb},0.08) 0%, transparent 70%)`,
                }}
              />
              <span
                className="relative text-[11px] font-medium uppercase tracking-[0.2em] text-[#5a7080]/70"
                aria-hidden
              >
                Preview coming soon
              </span>
            </>
          ) : (
            <div className="relative z-[1] w-full">{children}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function FeatureBlock({
  feature,
  reverse,
}: {
  feature: CoreFeature
  reverse: boolean
}) {
  const headingId = `core-feature-${feature.number}`
  const { cardGlow: accent, cardGlowRgb: accentRgb } = feature

  return (
    <section
      className="bg-[#090f18] py-20 md:py-28"
      aria-labelledby={headingId}
    >
      <div className="mx-auto max-w-7xl px-6">
        <ScrollRevealGroup
          className={cn(
            'grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20',
            reverse && 'lg:[&>*:first-child]:order-2',
          )}
        >
          <div className="max-w-xl">
            <RevealItem index={0}>
              <div className="flex items-start gap-4">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-transparent font-display text-base tracking-[0.08em] sm:h-12 sm:w-12 sm:text-lg"
                  style={{
                    color: accent,
                    border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`,
                  }}
                  aria-hidden
                >
                  {feature.number}
                </span>

                <div className="min-w-0 pt-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#728d9c] sm:text-xs">
                    Feature · {feature.category}
                  </p>
                  <span
                    className="mt-1.5 block h-px w-10"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accent} 70%, transparent)`,
                    }}
                    aria-hidden
                  />
                </div>
              </div>
            </RevealItem>

            <RevealItem index={1}>
              <h3
                id={headingId}
                className="mt-7 font-display text-[1.85rem] leading-[1.15] tracking-wide text-[#f0f4f8] sm:text-4xl md:text-[2.6rem] md:leading-[1.12]"
              >
                {feature.title}
              </h3>
            </RevealItem>

            <RevealItem index={2}>
              <p className="mt-5 text-base leading-relaxed text-[#728d9c] md:text-lg md:leading-relaxed">
                {feature.description}
              </p>
            </RevealItem>

            <RevealItem index={3} as="ul" className="mt-9 space-y-4">
              {feature.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-3.5 text-[#f0f4f8]"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      border: `1px solid rgba(${accentRgb},0.45)`,
                      backgroundColor: `rgba(${accentRgb},0.12)`,
                      color: accent,
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-[15px] leading-snug text-[#f0f4f8]/95 md:text-base">
                    {bullet}
                  </span>
                </li>
              ))}
            </RevealItem>
          </div>

          <RevealItem index={4}>
            <FeatureCardShell glow={accent} glowRgb={accentRgb}>
              {feature.number === '02' ? (
                <LandingLeaderboardPreview embedded />
              ) : null}
            </FeatureCardShell>
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}

/**
 * Five core product feature blocks for the logged-out landing page.
 * Cards are empty glowing placeholders for now.
 */
export function CoreFeaturesSection() {
  return (
    <div id="features">
      {CORE_FEATURES.map((feature, index) => (
        <FeatureBlock
          key={feature.number}
          feature={feature}
          reverse={index % 2 === 1}
        />
      ))}
    </div>
  )
}
