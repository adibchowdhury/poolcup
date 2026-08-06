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
 */
export function LandingHookVisual({ className }: LandingHookVisualProps) {
  return (
    <div
      className={cn(
        'landing-hook-visual group relative mx-auto w-full max-w-[18rem] bg-transparent sm:max-w-[20rem] md:max-w-[22rem]',
        className,
      )}
    >
      <span
        aria-hidden
        className="landing-hook-sparkle pointer-events-none absolute top-[8%] right-[4%] z-[3] h-1.5 w-1.5 rounded-full bg-[#00e676]/80"
      />
      <span
        aria-hidden
        className="landing-hook-sparkle landing-hook-sparkle--delayed pointer-events-none absolute top-[22%] left-[2%] z-[3] h-1 w-1 rounded-full bg-[#00e676]/55"
      />

      {/*
        Single float unit = phone bounds. Pucky is positioned in the phone's
        coordinate space (behind it), not in a wider outer card.
      */}
      <div className="landing-hook-phone relative mx-auto w-full origin-center bg-transparent">
        {/*
          Pucky tucked behind the phone's lower-left edge.
          Overlaps the phone so part of him is covered (z-0 under phone z-10).
        */}
        <div
          className={cn(
            'landing-hook-pucky pointer-events-none absolute z-0',
            /* Peek from lower-left: head/upper body clear of the phone edge */
            'bottom-[14%] left-[-22%] w-[58%] sm:bottom-[16%] sm:left-[-20%] sm:w-[56%]',
          )}
        >
          <Image
            src="/mascot/pucky_peeking.webp"
            alt=""
            width={900}
            height={600}
            className="h-auto w-full bg-transparent object-contain"
            sizes="(max-width: 768px) 40vw, 10rem"
            aria-hidden
          />
        </div>

        <Image
          src="/dashboard_mockup.webp"
          alt="PoolCup app on a phone — live pools and match predictions"
          width={900}
          height={1350}
          className="relative z-10 h-auto w-full bg-transparent object-contain"
          sizes="(max-width: 768px) 75vw, 20rem"
          priority={false}
        />
      </div>

      <span className="sr-only">
        Pucky the PoolCup mascot peeking from behind a phone showing the app
      </span>
    </div>
  )
}
