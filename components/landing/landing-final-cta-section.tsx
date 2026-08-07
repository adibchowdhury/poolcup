'use client'

import Image from 'next/image'
import { HeroConfetti } from '@/components/landing/hero-confetti'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'
import { WaitlistForm } from '@/components/landing/waitlist-form'

/** Subtle celebrating players around Pucky — keep sparse. */
const SIDE_AVATARS = [
  {
    src: '/avatars/cheerleader.png',
    className:
      'left-[-6%] top-[12%] h-12 w-12 sm:h-14 sm:w-14 md:left-[-8%] md:top-[8%]',
  },
  {
    src: '/avatars/goal_keeper.png',
    className:
      'right-[-4%] top-[22%] h-11 w-11 sm:h-12 sm:w-12 md:right-[-6%] md:top-[18%]',
  },
  {
    src: '/avatars/brown_skin_avatar.png',
    className:
      'bottom-[8%] left-[-2%] h-10 w-10 sm:h-12 sm:w-12 md:bottom-[10%] md:left-[-4%]',
  },
] as const

const VALUE_PROPS = [
  'Free to join',
  'Multiple sports',
  'Play with friends',
] as const

export function LandingFinalCtaSection() {
  return (
    <section
      id="join"
      aria-labelledby="final-cta-heading"
      className="relative isolate overflow-hidden bg-[#080b0f] py-20 md:py-28"
    >
      {/* Stadium lights + green glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: [
            'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,230,118,0.16) 0%, transparent 55%)',
            'radial-gradient(ellipse 50% 35% at 75% 40%, rgba(0,230,118,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse 45% 30% at 20% 70%, rgba(59,130,246,0.06) 0%, transparent 50%)',
            'radial-gradient(ellipse 90% 70% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 60%)',
          ].join(', '),
        }}
      />
      <div className="hero-glow-layer hero-glow-primary opacity-80" aria-hidden />
      <div className="hero-glow-layer hero-glow-secondary opacity-70" aria-hidden />
      <div className="hero-noise opacity-[0.04]" aria-hidden />

      <HeroConfetti className="opacity-70" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <ScrollRevealGroup className="grid items-center gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-10 lg:gap-14">
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
              <WaitlistForm id="waitlist-final" variant="cta" />
            </RevealItem>

            <RevealItem index={4}>
              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[#8fa0ad] md:justify-start">
                {VALUE_PROPS.map((label, index) => (
                  <li key={label} className="inline-flex items-center gap-3">
                    {index > 0 ? (
                      <span
                        className="hidden h-1 w-1 rounded-full bg-[#00e676]/70 sm:inline-block"
                        aria-hidden
                      />
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#00e676]/15 text-[10px] font-bold text-[#00e676]"
                        aria-hidden
                      >
                        ✓
                      </span>
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </RevealItem>
          </div>

          <RevealItem
            index={2}
            className="relative mx-auto w-full max-w-[22rem] md:max-w-none"
          >
            {/* Soft green bloom behind Pucky */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(0,230,118,0.28) 0%, transparent 70%)',
              }}
              aria-hidden
            />

            <div className="relative mx-auto aspect-square w-full max-w-[20rem] sm:max-w-[22rem] md:max-w-[26rem]">
              {SIDE_AVATARS.map((avatar) => (
                <div
                  key={avatar.src}
                  className={`pointer-events-none absolute z-[1] overflow-hidden rounded-full border border-white/10 bg-[#0d1520]/80 shadow-[0_0_20px_rgba(0,230,118,0.15)] ${avatar.className}`}
                  aria-hidden
                >
                  <Image
                    src={avatar.src}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover opacity-90"
                  />
                </div>
              ))}

              <Image
                src="/mascot/pucky_trophy.png"
                alt="Pucky holding the PoolCup trophy"
                width={640}
                height={640}
                className="relative z-[2] h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(0,230,118,0.25)]"
                priority={false}
              />
            </div>
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
