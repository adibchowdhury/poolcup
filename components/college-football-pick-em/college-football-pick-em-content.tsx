import Link from 'next/link'
import { Check, Link2, Trophy, Users, Zap } from 'lucide-react'
import { CollegeFootballPickEmHeroCtas } from '@/components/college-football-pick-em/college-football-pick-em-hero-ctas'
import { PickEmFaqAccordion } from '@/components/pick-em-marketing/pick-em-faq-accordion'
import { PickEmMatchupsSection } from '@/components/pick-em-marketing/pick-em-matchups-section'
import { CFB_PICK_EM_FAQ_ITEMS } from '@/src/lib/college-football-pick-em-faq'
import { CFB_PICK_EM_SEASON_YEAR } from '@/src/lib/college-football-pick-em-season'
import { NFL_PICK_EM_PAGE_HREF } from '@/src/lib/college-football-pick-em-links'
import type { PickEmSlateMatch } from '@/src/lib/pick-em-marketing-slate'
import { cn } from '@/lib/utils'

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Create your pool',
    body: 'Spin up a free college football pick\'em pool and lock it to the season.',
  },
  {
    number: '02',
    title: 'Invite your crew',
    body: 'Share one invite link — friends join your pick em league without an app-store detour.',
  },
  {
    number: '03',
    title: 'Make weekly picks',
    body: 'Before kickoff each Saturday, choose the winner of every game on the slate.',
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
    title: 'Curated Saturday slates',
    body: 'Roughly 15–25 games that matter each week — not every FBS kickoff, just the matchups your group cares about.',
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
    body: 'Works for a dorm-floor rivalry or a full office pick em pool.',
  },
] as const

const sectionPad = 'px-6 py-14 md:py-20'
const proseWidth = 'mx-auto max-w-3xl'
const contentWidth = 'mx-auto max-w-6xl'

type SlateEmptyState = 'prelaunch' | 'offseason' | 'loading'

function resolveSlateEmptyMessage(state: SlateEmptyState): string {
  if (state === 'prelaunch') {
    return `College football pick'em pools are launching this week — the ${CFB_PICK_EM_SEASON_YEAR} schedule will appear here as soon as we go live.`
  }
  if (state === 'offseason') {
    return 'College football season returns in August — check back when Saturdays matter again.'
  }
  return 'This week\'s slate is loading — check back soon.'
}

type CollegeFootballPickEmContentProps = {
  upcomingMatches: PickEmSlateMatch[]
  slateEmptyState: SlateEmptyState
}

/**
 * Body sections for /college-football-pick-em (server-rendered HTML).
 */
export function CollegeFootballPickEmContent({
  upcomingMatches,
  slateEmptyState,
}: CollegeFootballPickEmContentProps) {
  return (
    <>
      <section
        className={cn(sectionPad, 'border-t border-[rgba(255,255,255,0.06)]')}
        aria-labelledby="what-is-cfb-pick-em-heading"
      >
        <div className={proseWidth}>
          <h2
            id="what-is-cfb-pick-em-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            What is College Football Pick&apos;em?
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-[#728d9c] md:text-lg md:leading-relaxed">
            <p>
              College football pick&apos;em is simple: every week you pick the
              winner of the games on the Saturday slate. No spreads, no point
              totals — just who wins. Most correct weekly picks takes the top
              spot on the leaderboard.
            </p>
            <p>
              PoolCup is where you will run that pick&apos;em pool with your
              friends, office, or campus crew. You will create a free pool,
              share an invite link, and scoring will happen automatically when
              games end — with a curated slate of roughly 15–25 games that
              matter each week.
            </p>
          </div>
        </div>
      </section>

      {/*
        Week-hub seam: future /college-football-pick-em/week-N children link here.
        Stable anchor: #cfb-pick-em-matchups-heading
      */}
      <PickEmMatchupsSection
        headingId="cfb-pick-em-matchups-heading"
        heading="This Week's College Football Games"
        matches={upcomingMatches}
        emptyMessage={resolveSlateEmptyMessage(slateEmptyState)}
      />

      <section
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)] bg-[#090f18]',
        )}
        aria-labelledby="how-cfb-pick-em-works-heading"
      >
        <div className={contentWidth}>
          <h2
            id="how-cfb-pick-em-works-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            How College Football Pick&apos;em Works on PoolCup
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
        aria-labelledby="why-poolcup-cfb-heading"
      >
        <div className="mx-auto max-w-4xl">
          <h2
            id="why-poolcup-cfb-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Why Run Your College Football Pick&apos;em Pool on PoolCup
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

      {/*
        Pick-em hub seam: future /pick-em index can replace this row with a hub grid.
      */}
      <section
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)] bg-[#090f18]',
        )}
        aria-labelledby="more-pick-em-heading"
      >
        <div className={cn(proseWidth, 'text-center')}>
          <h2
            id="more-pick-em-heading"
            className="font-display text-xl tracking-wide text-[#f0f4f8] md:text-2xl"
          >
            More pick&apos;em
          </h2>
          <p className="mt-3 text-base text-[#728d9c]">
            <Link
              href={NFL_PICK_EM_PAGE_HREF}
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              NFL Pick&apos;em
            </Link>
          </p>
        </div>
      </section>

      <section
        className={cn(sectionPad, 'border-t border-[rgba(255,255,255,0.06)]')}
        aria-labelledby="cfb-pick-em-faq-heading"
      >
        <div className="mx-auto max-w-2xl">
          <h2
            id="cfb-pick-em-faq-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            College Football Pick&apos;em FAQ
          </h2>
          <PickEmFaqAccordion items={CFB_PICK_EM_FAQ_ITEMS} valuePrefix="cfb-faq" />
        </div>
      </section>

      <section
        id="launching"
        className={cn(
          sectionPad,
          'border-t border-[rgba(255,255,255,0.06)] bg-[#090f18] scroll-mt-20',
        )}
        aria-labelledby="cfb-pick-em-bottom-cta-heading"
      >
        <div className={cn(proseWidth, 'text-center')}>
          <h2
            id="cfb-pick-em-bottom-cta-heading"
            className="font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            College football pick&apos;em pools — launching this week
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#728d9c] md:text-lg">
            We are putting the finishing touches on CFB pools ahead of the{' '}
            {CFB_PICK_EM_SEASON_YEAR} season. NFL Pick&apos;em is live today if you want to compete now.
            Explore more on the{' '}
            <Link
              href="/"
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              PoolCup homepage
            </Link>
            {' '}or compare plans on{' '}
            <Link
              href="/pricing"
              className="font-medium text-[#00e676] underline-offset-4 hover:underline"
            >
              PoolCup pricing
            </Link>
            .
          </p>
          <CollegeFootballPickEmHeroCtas />
        </div>
      </section>
    </>
  )
}
