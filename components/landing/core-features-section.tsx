import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { HowItWorksDemo } from '@/components/home/how-it-works-demo'
import { LandingChatPreview } from '@/components/landing/landing-chat-preview'
import { LandingFeaturesIntro } from '@/components/landing/landing-features-intro'
import { LandingLeaderboardPreview } from '@/components/landing/landing-leaderboard-preview'
import { LandingPoolCustomizePreview } from '@/components/landing/landing-pool-customize-preview'
import { LandingProfilePreview } from '@/components/landing/landing-profile-preview'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'
import { cn } from '@/lib/utils'

type CoreFeature = {
  number: string
  /** Eyebrow/category label (e.g. Prediction Pools). */
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
    category: 'Pool Customization & Control',
    title: 'Your pool, your rules.',
    description:
      'Name your pool, choose your colors, and set your own scoring rules. As the host, you decide how your pool looks and plays — and keep everyone in the loop with announcements.',
    bullets: [
      'Custom pool name & colors',
      'Set your own scoring rules',
      'Host controls & member management',
      'Announcements to keep your pool in the loop',
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
      'Accuracy, stats & career highlights',
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
    <div className="relative w-full">
      {/*
        Soft accent halo via static radial gradients + box-shadow — NOT filter:drop-shadow.
        filter on the card subtree forces costly repaints while scrolling; gradients/box-shadow do not.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem]"
        style={{
          background: [
            `radial-gradient(ellipse 75% 65% at 50% 45%, rgba(${glowRgb},0.28) 0%, transparent 58%)`,
            `radial-gradient(ellipse 95% 85% at 50% 55%, rgba(${glowRgb},0.12) 0%, transparent 72%)`,
          ].join(', '),
        }}
      />

      {/* Outer glass frame — semi-transparent fill, no backdrop-filter blur */}
      <div
        className="rounded-[1.35rem] p-[5px] sm:p-1.5"
        style={{
          border: '1px solid rgba(255,255,255,0.28)',
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(15,20,28,0.88) 48%, rgba(255,255,255,0.03) 100%)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.16)',
            'inset 0 0 0 1px rgba(255,255,255,0.05)',
            `0 0 28px rgba(${glowRgb},0.2)`,
            `0 0 56px rgba(${glowRgb},0.08)`,
            '0 12px 36px rgba(0,0,0,0.4)',
          ].join(', '),
        }}
      >
        {/* Inner dark card — gap from outer frame via parent padding */}
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-[1.05rem] bg-app-background',
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
  compactTop = false,
  blendIntoCta = false,
}: {
  feature: CoreFeature
  reverse: boolean
  /** First block after the features intro — avoid stacking huge top padding. */
  compactTop?: boolean
  /** Last block — fade bottom edge into the final CTA seam color. */
  blendIntoCta?: boolean
}) {
  const headingId = `core-feature-${feature.number}`
  const { cardGlow: accent, cardGlowRgb: accentRgb } = feature

  return (
    <section
      className={cn(
        'relative',
        !blendIntoCta && 'bg-[#090f18]',
        compactTop
          ? 'pt-8 pb-12 md:pt-12 md:pb-28'
          : 'py-12 md:py-28',
      )}
      style={
        blendIntoCta
          ? {
              /* Solid features hue → CTA seam `#0d121a` (matches CTA top). */
              background:
                'linear-gradient(to bottom, #090f18 0%, #090f18 70%, #0d121a 100%)',
            }
          : undefined
      }
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
                    {feature.category}
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
              {feature.number === '01' ? (
                <HowItWorksDemo embedded />
              ) : feature.number === '02' ? (
                <LandingLeaderboardPreview embedded />
              ) : feature.number === '03' ? (
                <LandingPoolCustomizePreview embedded />
              ) : feature.number === '04' ? (
                <LandingProfilePreview embedded />
              ) : feature.number === '05' ? (
                <LandingChatPreview embedded />
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
 * Section 01: pool walkthrough · 02: leaderboard · 03: pool customize ·
 * 04: profile · 05: pool chat.
 */
export function CoreFeaturesSection() {
  return (
    <div id="features">
      <LandingFeaturesIntro />
      {CORE_FEATURES.map((feature, index) => (
        <FeatureBlock
          key={feature.number}
          feature={feature}
          reverse={index % 2 === 1}
          compactTop={index === 0}
          blendIntoCta={index === CORE_FEATURES.length - 1}
        />
      ))}
    </div>
  )
}
