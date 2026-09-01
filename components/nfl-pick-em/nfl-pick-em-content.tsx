import Link from 'next/link'
import { Check, Link2, Trophy, Users, Zap } from 'lucide-react'
import { NflPickEmHeroCtas } from '@/components/nfl-pick-em/nfl-pick-em-hero-ctas'
import { NflPickEmMatchups } from '@/components/nfl-pick-em/nfl-pick-em-matchups'
import { NflPickEmFaqAccordion } from '@/components/nfl-pick-em/nfl-pick-em-faq-accordion'
import type { NflPickEmSlateMatch } from '@/src/lib/fetch-nfl-pick-em-slate'
import { NFL_PICK_EM_FAQ_ITEMS } from '@/src/lib/nfl-pick-em-faq'
import { cn } from '@/lib/utils'

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Create your pool',
    body: 'Spin up a free NFL pick\'em pool in minutes and lock it to the season.',
  },
  {
    number: '02',
    title: 'Invite your crew',
    body: 'Share one invite link — friends join your league without an app-store detour.',
  },
  {
    number: '03',
    title: 'Make weekly picks',
    body: 'Before kickoff each week, choose the winner of every game on the slate.',
  },
  {
    number: '04',
    title: 'Climb the leaderboard',
    body: 'Correct picks stack up. Live standings show who\'s rising after every final whistle.',
  },
] as const

const WHY_ITEMS = [
  {
    icon: Zap,
    title: 'Automatic scoring',
    body: 'No spreadsheets, no arguments — results post and the board updates itself.',
  },
  {
    icon: Trophy,
    title: 'Live leaderboards',
    body: 'Movement arrows and hot streaks show who\'s climbing week to week.',
  },
  {
    icon: Check,
    title: 'Free to play',
    body: 'Create a Basic pool and compete at no cost. Members always play free.',
  },
  {
    icon: Link2,
    title: 'Invite-link simple',
    body: 'One link brings your crew in. No codes to memorize, no complicated setup.',
  },
  {
    icon: Users,
    title: 'Any group size',
    body: 'Works for a three-person office chat or a full league of rivals.',
  },
] as const

const sectionPad = 'px-6 py-14 md:py-20'
const proseWidth = 'mx-auto max-w-3xl'
const contentWidth = 'mx-auto max-w-6xl'

type NflPickEmContentProps = {
  upcomingMatches: NflPickEmSlateMatch[]
}

/**
 * Body sections for /nfl-pick-em (server-rendered HTML).
 * How-it-works / why use H3s under their H2s. FAQ uses Accordion triggers (not H3).
 */
export function NflPickEmContent({ upcomingMatches }: NflPickEmContentProps) {
  return (
    <>
      <section
        className={cn(sectionPad, 'border-t border-[rgba(255,255,255,0.06)]')}
        aria-labelledby="what-is-nfl-pick-em-heading"
      >
        <div className={proseWidth}>
          <h2
            id="what-is-nfl-pick-em-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            What is NFL Pick&apos;em?
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-[#728d9c] md:text-lg md:leading-relaxed">
            <p>
              NFL Pick&apos;em is simple: every week you pick the winner of every
              NFL game. No spreads, no point totals — just who wins. Most correct
              weekly picks takes the top spot on the leaderboard.
            </p>
            <p>
              PoolCup is where you run that pick&apos;em pool with your friends,
              office, or league. Create a free pool, share an invite link, and
              scoring happens automatically when the games end.
            </p>
          </div>
        </div>
      </section>

      <NflPickEmMatchups matches={upcomingMatches} />

      <section
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)] bg-[#090f18]',
        )}
        aria-labelledby="how-nfl-pick-em-works-heading"
      >
        <div className={contentWidth}>
          <h2
            id="how-nfl-pick-em-works-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            How NFL Pick&apos;em Works on PoolCup
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <li key={step.number} className="min-w-0">
                <div className="flex items-start gap-3.5">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#00e676]/55 font-display text-base tracking-[0.08em] text-[#00e676] sm:h-12 sm:w-12 sm:text-lg"
                    aria-hidden
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0 pt-1">
                    <h3 className="font-display text-xl tracking-wide text-[#f0f4f8] sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#728d9c] md:text-[15px]">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className={cn(sectionPad, 'border-t border-[rgba(255,255,255,0.06)]')}
        aria-labelledby="why-poolcup-heading"
      >
        <div className="mx-auto max-w-4xl">
          <h2
            id="why-poolcup-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Why Run Your Pick&apos;em Pool on PoolCup
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {WHY_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0e12]/80 px-4 py-4"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00e676]/12 text-[#00e676]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg tracking-wide text-[#f0f4f8]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#728d9c]">
                      {item.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Phase 4: FAQ */}
      <section
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)]',
        )}
        aria-labelledby="nfl-pick-em-faq-heading"
      >
        <div className="mx-auto max-w-2xl">
          <h2
            id="nfl-pick-em-faq-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            NFL Pick&apos;em FAQ
          </h2>
          <NflPickEmFaqAccordion items={NFL_PICK_EM_FAQ_ITEMS} />
        </div>
      </section>

      <section
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)] bg-[#090f18]',
        )}
        aria-labelledby="nfl-pick-em-bottom-cta-heading"
      >
        <div className={cn(proseWidth, 'text-center')}>
          <h2
            id="nfl-pick-em-bottom-cta-heading"
            className="font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Ready to start your NFL pick&apos;em pool?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#728d9c] md:text-lg">
            Explore more on the{' '}
            <Link
              href="/"
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              PoolCup homepage
            </Link>
            , compare plans on{' '}
            <Link
              href="/pricing"
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              PoolCup pricing
            </Link>
            , or create your pool now.
          </p>
          <NflPickEmHeroCtas />
        </div>
      </section>
    </>
  )
}
