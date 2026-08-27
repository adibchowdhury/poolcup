'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Subtle multi-sport cue — scattered around the phone, not crowded. */
const FLOATING_SPORT_BALLS = [
  {
    src: '/sports/soccer.png',
    className:
      'left-[-2%] top-[6%] h-9 w-9 sm:h-11 sm:w-11 md:left-[-6%] md:top-[4%] md:h-12 md:w-12',
    delayClass: 'landing-hook-ball--a',
  },
  {
    src: '/sports/basketball.png',
    className:
      'right-[-1%] top-[12%] h-10 w-10 sm:h-12 sm:w-12 md:right-[-5%] md:top-[10%] md:h-12 md:w-12',
    delayClass: 'landing-hook-ball--b',
  },
  {
    src: '/sports/football.png',
    className:
      'left-[-4%] top-[48%] h-10 w-10 sm:h-12 sm:w-12 md:left-[-10%] md:top-[46%] md:h-14 md:w-14',
    delayClass: 'landing-hook-ball--c',
  },
  {
    src: '/sports/hockey.png',
    className:
      'right-[-3%] top-[42%] h-8 w-8 sm:h-10 sm:w-10 md:right-[-8%] md:top-[40%] md:h-11 md:w-11',
    delayClass: 'landing-hook-ball--d',
  },
  {
    src: '/sports/baseball.png',
    className:
      'left-[2%] bottom-[8%] h-8 w-8 sm:h-9 sm:w-9 md:left-[-2%] md:bottom-[6%] md:h-10 md:w-10',
    delayClass: 'landing-hook-ball--e',
  },
  {
    src: '/sports/cricket.png',
    className:
      'right-[0%] bottom-[14%] h-9 w-9 sm:h-10 sm:w-10 md:right-[-4%] md:bottom-[12%] md:h-11 md:w-11',
    delayClass: 'landing-hook-ball--f',
  },
] as const

type LandingHookVisualProps = {
  className?: string
}

/**
 * Bare phone mockup + Pucky peeking + subtle floating sport balls.
 * No card/panel/background behind the phone — section bg shows through.
 * Motion: transform/opacity only.
 */
export function LandingHookVisual({ className }: LandingHookVisualProps) {
  return (
    <div
      className={cn(
        'landing-hook-visual group relative mx-auto flex w-full max-w-full justify-center bg-transparent',
        className,
      )}
    >
      <div
        className={cn(
          'relative w-full',
          /* Mobile: near-full column; lean % gutters for peek + balls */
          'max-w-[min(100%,calc(36rem+2*3.5rem))] px-[9%]',
          /* Desktop: moderate phone ~20–22rem */
          'md:max-w-[calc(20rem+2*3.5rem)] md:px-[3.5rem]',
          'lg:max-w-[calc(22rem+2*3.75rem)] lg:px-[3.75rem]',
        )}
      >
        <span
          aria-hidden
          className="landing-hook-sparkle pointer-events-none absolute top-[8%] right-[16%] z-[3] h-1.5 w-1.5 rounded-full bg-[#00e676]/80"
        />
        <span
          aria-hidden
          className="landing-hook-sparkle landing-hook-sparkle--delayed pointer-events-none absolute top-[22%] left-[12%] z-[3] h-1 w-1 rounded-full bg-[#00e676]/55"
        />

        {FLOATING_SPORT_BALLS.map((ball) => (
          <Image
            key={ball.src}
            src={ball.src}
            alt=""
            width={96}
            height={96}
            className={cn(
              'landing-hook-ball pointer-events-none absolute z-[2] object-contain opacity-80 drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]',
              ball.className,
              ball.delayClass,
            )}
            aria-hidden
          />
        ))}

        <div className="landing-hook-phone relative mx-auto w-full origin-center bg-transparent">
          <div
            className={cn(
              'landing-hook-pucky pointer-events-none absolute z-0',
              'bottom-[9%] left-[-18%] w-[57%] sm:bottom-[11%] sm:left-[-17%] sm:w-[55%]',
            )}
          >
            <Image
              src="/mascot/pucky_peeking.webp"
              alt=""
              width={900}
              height={600}
              className="h-auto w-full bg-transparent object-contain"
              sizes="(max-width: 768px) 65vw, 16rem"
              aria-hidden
            />
          </div>

          <Image
            src="/dashboard_mockup.webp"
            alt="PoolCup app on a phone — live pools and match predictions"
            width={2000}
            height={3000}
            className="relative z-10 h-auto w-full max-w-none bg-transparent object-contain [image-rendering:auto]"
            sizes="(max-width: 768px) 90vw, (max-width: 1024px) 20rem, 22rem"
            priority={false}
          />
        </div>
      </div>

      <span className="sr-only">
        Pucky the PoolCup mascot peeking from behind a phone showing the app,
        surrounded by sport balls
      </span>
    </div>
  )
}
