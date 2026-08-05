'use client'

import Link from 'next/link'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  PoolCard,
  type DashboardPoolCardData,
} from '@/components/dashboard/pool-card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

const LANDING_GET_STARTED_HREF = '/login?next=/create'

/** Static example pool — illustrative only; all CTAs go to signup. */
const EXAMPLE_POOL: DashboardPoolCardData = {
  id: 'example-world-cup-fanatics',
  name: 'World Cup Fanatics',
  eventName: 'FIFA World Cup 2026',
  scoringStyle: 'classic',
  inviteCode: 'PREVIEW',
  members: 24,
  memberAvatars: [
    { displayName: 'Sarah', avatar: 'goal_keeper.png' },
    { displayName: 'Jordan', avatar: 'white_skin_avatar.png' },
    { displayName: 'Alex', avatar: 'brown_skin_avatar.png' },
    { displayName: 'Riley', avatar: 'cheerleader.png' },
  ],
  yourRank: 2,
  movement: 'up',
  rankDelta: 3,
  totalPredictions: 72,
  yourPredictions: 48,
  // Far-future kickoff so the real card shows "Predict Now" in preview mode.
  nextMatchKickoffAt: '2030-06-15T18:00:00.000Z',
  predictionsLocked: false,
  canDelete: false,
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

function useInViewOnce<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [inView])

  return [ref, inView]
}

function useCountUp(
  target: number,
  active: boolean,
  reducedMotion: boolean,
  durationMs = 1200,
): number {
  const [value, setValue] = useState(reducedMotion ? target : 0)

  useEffect(() => {
    if (reducedMotion) {
      setValue(target)
      return
    }
    if (!active) return

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, durationMs, reducedMotion, target])

  return value
}

function LivePulse({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00e676]">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00e676]/50 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00e676]" />
      </span>
      {label}
    </span>
  )
}

/** Shared height so carousel cards align with the real dashboard PoolCard. */
const SHOWCASE_CARD_MIN_H = 'min-h-[26.5rem]'

function ShowcaseCardShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border border-[rgba(255,255,255,0.1)]',
        'bg-[#121c28] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
        SHOWCASE_CARD_MIN_H,
        className,
      )}
    >
      {children}
    </article>
  )
}

function FeaturedPoolShowcaseCard() {
  return (
    <div className={cn('h-full', SHOWCASE_CARD_MIN_H)}>
      <PoolCard
        pool={EXAMPLE_POOL}
        previewActionHref={LANDING_GET_STARTED_HREF}
        surface="dashboard"
      />
    </div>
  )
}

function LiveMatchCard({
  active,
  reducedMotion,
}: {
  active: boolean
  reducedMotion: boolean
}) {
  const predictions = useCountUp(18432, active, reducedMotion)

  return (
    <ShowcaseCardShell>
      <LivePulse label="89'" />

      <div className="mt-4 flex items-center justify-center gap-3">
        <span className="text-xl" aria-hidden>
          ⚽
        </span>
        <span className="font-display text-2xl tracking-wide text-[#f0f4f8]">
          Spain
        </span>
        <span className="font-mono text-sm text-[#728d9c]">vs</span>
        <span className="font-display text-2xl tracking-wide text-[#f0f4f8]">
          Belgium
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.25)] px-4 py-3">
        <p className="text-sm text-[#f0f4f8]">
          <span className="font-mono font-semibold tabular-nums text-[#00e676]">
            {predictions.toLocaleString('en-US')}
          </span>{' '}
          predictions
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#728d9c]">
          Most predicted:{' '}
          <span className="font-medium text-[#f0f4f8]/90">2–1 Spain (41%)</span>
        </p>
      </div>

      {!reducedMotion ? (
        <div className="mt-4 flex justify-center opacity-70" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sports/soccer.png"
            alt=""
            className="h-8 w-8 animate-join-ball-spin"
          />
        </div>
      ) : null}

      <Link
        href={LANDING_GET_STARTED_HREF}
        className={cn(
          'mt-auto inline-flex min-h-10 items-center justify-center rounded-lg',
          'border border-[#00e676]/40 bg-transparent px-4 text-sm font-semibold text-[#00e676]',
          'transition-colors hover:bg-[#00e676]/10 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121c28]',
        )}
      >
        Make Prediction
      </Link>
    </ShowcaseCardShell>
  )
}

type LeaderboardDemoRow = {
  id: string
  medal: string
  name: string
  points: number
  highlight?: boolean
  note?: string
}

const LEADERBOARD_A: LeaderboardDemoRow[] = [
  { id: 's', medal: '🥇', name: 'Sarah', points: 127 },
  { id: 'j', medal: '🥈', name: 'Jordan', points: 125 },
  { id: 'a', medal: '🥉', name: 'Alex', points: 122 },
  {
    id: 'you',
    medal: '#14',
    name: 'You',
    points: 98,
    highlight: true,
    note: '↑ +3',
  },
]

const LEADERBOARD_B: LeaderboardDemoRow[] = [
  { id: 'j', medal: '🥇', name: 'Jordan', points: 128 },
  { id: 's', medal: '🥈', name: 'Sarah', points: 127 },
  { id: 'a', medal: '🥉', name: 'Alex', points: 122 },
  {
    id: 'you',
    medal: '#14',
    name: 'You',
    points: 99,
    highlight: true,
    note: '↑ +3',
  },
]

function LiveLeaderboardCard({ reducedMotion }: { reducedMotion: boolean }) {
  const [variant, setVariant] = useState(0)
  const rows = variant % 2 === 0 ? LEADERBOARD_A : LEADERBOARD_B

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      setVariant((previous) => previous + 1)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <ShowcaseCardShell>
      <p className="font-display text-xl tracking-wide text-[#f0f4f8]">
        <span aria-hidden>🏆</span> Leaderboard
      </p>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ease-out motion-reduce:transition-none',
              row.highlight
                ? 'border border-[#00e676]/30 bg-[#00e676]/10'
                : 'border border-transparent bg-[rgba(255,255,255,0.03)]',
            )}
          >
            <span
              className={cn(
                'flex w-8 shrink-0 justify-center text-sm',
                row.highlight ? 'font-mono text-xs text-[#00e676]' : 'text-base',
              )}
            >
              {row.medal}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-medium',
                row.highlight ? 'text-[#00e676]' : 'text-[#f0f4f8]',
              )}
            >
              {row.name}
            </span>
            {row.note ? (
              <span className="shrink-0 text-xs font-medium text-[#00e676]">
                {row.note}
              </span>
            ) : null}
            <span className="shrink-0 font-mono text-sm tabular-nums text-[#f0f4f8]">
              +{row.points}
            </span>
          </li>
        ))}
      </ul>
    </ShowcaseCardShell>
  )
}

export function JoinTheActionSection() {
  const reducedMotion = usePrefersReducedMotion()
  const [sectionRef, inView] = useInViewOnce<HTMLElement>()
  const animate = inView || reducedMotion

  return (
    <section
      ref={sectionRef}
      id="join-the-action"
      className="bg-background pb-16 pt-24 md:pb-20 md:pt-28"
      aria-labelledby="join-the-action-heading"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 flex items-center justify-center">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00e676]/45 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00e676]" />
            </span>
          </div>
          <h2
            id="join-the-action-heading"
            className="font-display text-4xl tracking-wide text-[#f0f4f8] md:text-5xl lg:text-6xl"
          >
            Join the Action
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#728d9c] md:text-lg">
            Thousands of predictions. One leaderboard. Every match tells a
            different story.
          </p>
        </div>

        <div className="relative mt-10 px-0 md:mt-12 md:px-12">
          <Carousel
            opts={{
              align: 'start',
              loop: false,
            }}
            className="w-full"
            aria-label="PoolCup experience"
          >
            <CarouselContent className="-ml-4 items-stretch">
              <CarouselItem className="basis-[88%] pl-4 sm:basis-[70%] md:basis-1/2 lg:basis-1/3">
                <FeaturedPoolShowcaseCard />
              </CarouselItem>
              <CarouselItem className="basis-[88%] pl-4 sm:basis-[70%] md:basis-1/2 lg:basis-1/3">
                <LiveMatchCard
                  active={animate}
                  reducedMotion={reducedMotion}
                />
              </CarouselItem>
              <CarouselItem className="basis-[88%] pl-4 sm:basis-[70%] md:basis-1/2 lg:basis-1/3">
                <LiveLeaderboardCard reducedMotion={reducedMotion} />
              </CarouselItem>
            </CarouselContent>

            <CarouselPrevious
              className={cn(
                'left-0 hidden border-[rgba(255,255,255,0.15)] bg-[#121c28]/95 text-[#f0f4f8]',
                'hover:bg-[#1a2535] hover:text-[#00e676] md:inline-flex',
                'focus-visible:ring-[#00e676]',
              )}
            />
            <CarouselNext
              className={cn(
                'right-0 hidden border-[rgba(255,255,255,0.15)] bg-[#121c28]/95 text-[#f0f4f8]',
                'hover:bg-[#1a2535] hover:text-[#00e676] md:inline-flex',
                'focus-visible:ring-[#00e676]',
              )}
            />
          </Carousel>
        </div>
      </div>
    </section>
  )
}
