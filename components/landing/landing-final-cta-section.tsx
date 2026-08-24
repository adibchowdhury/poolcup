'use client'

import Image from 'next/image'
import { HeroConfetti } from '@/components/landing/hero-confetti'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'
import { LandingLaunchCtas } from '@/components/landing/landing-launch-ctas'

/**
 * Final celebratory CTA before the footer.
 *
 * Seam with feature 05 bottom: `#0d121a` (both edges identical).
 * Then fades to app background `#131313` for the footer.
 *
 * Hard-line causes addressed:
 * - Parent page `bg-background` (#131313) hairline gaps → slight overlap (`-mt-px`)
 * - Noise / stadium overlays starting abruptly → masked in from the top
 */
export function LandingFinalCtaSection() {
  return (
    <section
      id="join"
      aria-labelledby="final-cta-heading"
      className="relative isolate -mt-px overflow-hidden py-14 md:py-20"
      style={{
        background:
          'linear-gradient(to bottom, #0d121a 0%, #0d121a 12%, #101010 55%, #131313 100%)',
      }}
    >
      {/* Stadium lights — fade in below the seam so they don't cut a top edge */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: [
            'radial-gradient(ellipse 50% 35% at 75% 45%, rgba(0,230,118,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse 45% 30% at 20% 75%, rgba(59,130,246,0.06) 0%, transparent 50%)',
          ].join(', '),
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 22%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%)',
        }}
      />
      <div
        className="hero-glow-layer hero-glow-secondary opacity-70"
        aria-hidden
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 28%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 28%)',
        }}
      />
      <div
        className="hero-noise opacity-[0.04]"
        aria-hidden
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 24%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 24%)',
        }}
      />

      <HeroConfetti className="opacity-70" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <ScrollRevealGroup className="grid items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-6 lg:gap-10">
          <div className="min-w-0 text-center md:text-left">
            <RevealItem index={0}>
              <p className="font-display text-sm tracking-[0.2em] text-[#00e676] uppercase">
                Claim your glory
              </p>
            </RevealItem>

            <RevealItem index={1}>
              <h2
                id="final-cta-heading"
                className="mt-4 font-display text-4xl leading-[1.05] tracking-wide text-[#f0f4f8] sm:text-5xl md:text-[3.25rem] md:leading-[1.02] lg:text-6xl"
              >
                <span className="hero-glory-glow text-[#00e676]">
                  READY TO CLAIM YOUR BRAGGING RIGHTS?
                </span>
              </h2>
            </RevealItem>

            <RevealItem index={2}>
              <p className="mt-5 font-display text-2xl tracking-wide text-[#f0f4f8] sm:text-3xl">
                Your squad is waiting.
              </p>
              <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-[#8fa0ad] md:mx-0 md:text-lg">
                Create your first pool, invite your friends, and find out who
                actually knows sports.
              </p>
            </RevealItem>

            <RevealItem index={3} className="mx-auto mt-8 w-full max-w-xl md:mx-0">
              <LandingLaunchCtas size="section" align="start" />
            </RevealItem>
          </div>

          <RevealItem
            index={2}
            className="relative mx-auto w-full max-w-[26rem] sm:max-w-[30rem] md:max-w-none"
          >
            {/* Soft green bloom behind Pucky */}
            <div
              className="pointer-events-none absolute left-1/2 top-[45%] h-[55%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(0,230,118,0.28) 0%, transparent 70%)',
              }}
              aria-hidden
            />

            <Image
              src="/mascot/pucky_trophy.png"
              alt="Pucky holding the PoolCup trophy"
              width={720}
              height={720}
              className="relative z-[2] mx-auto h-auto w-full max-w-[22rem] object-contain drop-shadow-[0_12px_40px_rgba(0,230,118,0.25)] sm:max-w-[26rem] md:max-w-[30rem] lg:max-w-[34rem]"
              sizes="(max-width: 640px) 22rem, (max-width: 768px) 26rem, (max-width: 1024px) 30rem, 34rem"
              priority={false}
            />
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
