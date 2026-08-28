'use client'

import Image from 'next/image'
import { Crown } from 'lucide-react'
import { LoginPanelConfetti } from '@/components/auth/login-panel-confetti'
import { cn } from '@/lib/utils'

/**
 * Login victory podium — photo avatars, lucide Crown on 1st (leaderboard gold),
 * charcoal pillars with bottom fade into panel #20221F.
 */

const ENTRANTS = {
  1: {
    name: 'Alex Smith',
    points: 312,
    avatarSrc: '/login_assets/player3.jpg',
  },
  2: {
    name: 'Jordan Lee',
    points: 287,
    avatarSrc: '/login_assets/player2.jpg',
  },
  3: {
    name: 'Sam Taylor',
    points: 264,
    avatarSrc: '/login_assets/player1.jpg',
  },
} as const

/** Height hierarchy maintained (1st > 2nd > 3rd). */
const PILLAR_H = {
  1: 'h-[9.5rem]',
  2: 'h-[6.75rem]',
  3: 'h-[5rem]',
} as const

const ACCENT_GREEN = 'var(--primary)'

const PILLAR_FACE =
  'linear-gradient(180deg, #1f1f1f 0%, #171717 38%, #121212 78%, #0e0e0e 100%)'
const PILLAR_EDGE = 'color-mix(in srgb, #171717 42%, #000000)'
const PILLAR_SHADOW = `3px 3px 0 0 ${PILLAR_EDGE}`
const PILLAR_FADE_MASK =
  'linear-gradient(to bottom, #000 0%, #000 calc(100% - 2rem), transparent 100%)'

function PodiumAvatar({
  src,
  objectPosition,
}: {
  src: string
  objectPosition: string
}) {
  return (
    <div
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#2a2a2a] ring-1 ring-white/10"
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="64px"
        className="object-cover"
        style={{ objectPosition }}
        priority={false}
      />
    </div>
  )
}

function PodiumColumn({ place }: { place: 1 | 2 | 3 }) {
  const label = place === 1 ? '1ST' : place === 2 ? '2ND' : '3RD'
  const entrant = ENTRANTS[place]

  return (
    <div
      className={cn(
        'flex flex-col items-center px-0',
        place === 1 && 'order-2 w-[38%] max-w-[8.25rem]',
        place === 2 && 'order-1 w-[28%] max-w-[6.25rem]',
        place === 3 && 'order-3 w-[28%] max-w-[6.25rem]',
      )}
    >
      <div className="mb-2 flex min-h-[6.75rem] w-full flex-col items-center justify-end gap-1.5">
        {place === 1 ? (
          // Same stack as 2nd/3rd (avatar centered over pillar) + floating gold crown.
          <div className="flex flex-col items-center">
            <div className="login-crown-wrap relative mb-0.5 flex items-center justify-center">
              <span className="login-crown-glow-layer" aria-hidden />
              <Crown
                className="login-crown-icon relative z-[1] h-5 w-5 text-[#ffb300]"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <PodiumAvatar
              src={ENTRANTS[1].avatarSrc}
              objectPosition="50% 35%"
            />
          </div>
        ) : place === 2 ? (
          <PodiumAvatar
            src={ENTRANTS[2].avatarSrc}
            objectPosition="78% 48%"
          />
        ) : (
          <PodiumAvatar
            src={ENTRANTS[3].avatarSrc}
            objectPosition="50% 40%"
          />
        )}

        <div className="w-full px-0.5 text-center">
          <p className="truncate text-xs font-semibold leading-tight text-white sm:text-[13px]">
            {entrant.name}
          </p>
          <p
            className="mt-0.5 font-display text-lg tabular-nums leading-none tracking-wide"
            style={{ color: ACCENT_GREEN }}
          >
            {entrant.points}
            <span className="ml-1 font-display text-[11px] font-normal tracking-wide text-white/55">
              pts
            </span>
          </p>
        </div>
      </div>

      <div
        className={cn(
          'relative flex w-full flex-col items-center overflow-hidden rounded-md',
          PILLAR_H[place],
        )}
        style={{
          background: PILLAR_FACE,
          boxShadow: PILLAR_SHADOW,
          WebkitMaskImage: PILLAR_FADE_MASK,
          maskImage: PILLAR_FADE_MASK,
        }}
        aria-hidden
      >
        <div
          className="h-[2.5px] w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${ACCENT_GREEN} 16%, ${ACCENT_GREEN} 84%, transparent 100%)`,
            opacity: place === 1 ? 0.95 : 0.78,
            boxShadow:
              place === 1
                ? '0 0 10px color-mix(in srgb, var(--primary) 50%, transparent)'
                : '0 0 6px color-mix(in srgb, var(--primary) 28%, transparent)',
          }}
        />
        <span
          className={cn(
            'mt-2.5 font-display tracking-[0.14em] text-white/90',
            place === 1 ? 'text-[13px]' : 'text-xs',
          )}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

export function LoginPanelLeaderboard() {
  return (
    <div className="relative z-10 mx-auto w-[86%] max-w-[21rem] shrink-0">
      <div className="relative">
        <section
          aria-label="Championship podium"
          // Proportional flex gap — decisive tighten (~half prior clamp).
          // Floor keeps a hairline split; ceiling stays sub-floating.
          className="flex items-end justify-center gap-[clamp(3px,0.3vw,6px)]"
        >
          <PodiumColumn place={2} />
          <PodiumColumn place={1} />
          <PodiumColumn place={3} />
        </section>

        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <LoginPanelConfetti density="sparse" className="z-0" />
        </div>
      </div>
    </div>
  )
}
