import { Check } from 'lucide-react'
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
  },
]

function FeaturePlaceholderCard() {
  return (
    <div
      className={cn(
        'relative flex min-h-[20rem] w-full items-center justify-center overflow-hidden rounded-2xl sm:min-h-[24rem]',
        'border border-[#00e676]/30 bg-[#0a0e12]',
        'shadow-[0_0_0_1px_rgba(0,230,118,0.08),0_0_40px_rgba(0,230,118,0.18),0_0_80px_rgba(0,230,118,0.08)]',
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_40%,rgba(0,230,118,0.07)_0%,transparent_70%)]" />
      <span className="relative text-[11px] font-medium uppercase tracking-[0.2em] text-[#5a7080]/70">
        Preview coming soon
      </span>
    </div>
  )
}

function FeatureBlock({
  feature,
  reverse,
  tone,
}: {
  feature: CoreFeature
  reverse: boolean
  tone: 'dark' | 'base'
}) {
  const headingId = `core-feature-${feature.number}`

  return (
    <section
      className={cn(
        'py-20 md:py-28',
        tone === 'dark' ? 'bg-[#0d1520]' : 'bg-background',
      )}
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
                  className={cn(
                    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                    'border border-[#00e676]/55 bg-transparent',
                    'font-display text-base tracking-[0.08em] text-[#00e676] sm:h-12 sm:w-12 sm:text-lg',
                  )}
                  aria-hidden
                >
                  {feature.number}
                </span>

                <div className="min-w-0 pt-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#728d9c] sm:text-xs">
                    Feature · {feature.category}
                  </p>
                  <span
                    className="mt-1.5 block h-px w-10 bg-[#00e676]/70"
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
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#00e676]/45 bg-[#00e676]/12">
                    <Check
                      className="h-3 w-3 text-[#00e676]"
                      strokeWidth={3}
                      aria-hidden
                    />
                  </span>
                  <span className="text-[15px] leading-snug text-[#f0f4f8]/95 md:text-base">
                    {bullet}
                  </span>
                </li>
              ))}
            </RevealItem>
          </div>

          <RevealItem index={4}>
            <FeaturePlaceholderCard />
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
          tone={index % 2 === 0 ? 'base' : 'dark'}
        />
      ))}
    </div>
  )
}
