'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

type LandingHookVisualProps = {
  className?: string
}

/**
 * Bare phone mockup + Pucky peeking from behind the phone.
 * No card/panel/background behind the phone — section bg shows through.
 * Motion: transform/opacity only.
 *
 * Size model: the PHONE has an explicit large width; equal peek gutters sit
 * outside it so the combined phone+Pucky unit stays centered.
 */
export function LandingHookVisual({ className }: LandingHookVisualProps) {
  return (
    <div
      className={cn(
        'landing-hook-visual group relative mx-auto flex w-full max-w-full justify-center bg-transparent',
        className,
      )}
    >
      {/*
        Composition box = phone + equal L/R gutters (~18% of phone).
        Phone widths are explicit so the grid column / % padding can't shrink it.
      */}
      <div
        className={cn(
          'relative w-full',
          /* Mobile: near-full column; lean % gutters for peek only */
          'max-w-[min(100%,calc(36rem+2*3.5rem))] px-[9%]',
          /* Desktop: moderate phone ~20–22rem (comfortable, not dominant) */
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
        Pucky the PoolCup mascot peeking from behind a phone showing the app
      </span>
    </div>
  )
}
