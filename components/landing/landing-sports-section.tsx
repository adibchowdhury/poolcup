'use client'

import Image from 'next/image'
import { useState } from 'react'
import { LandingHookVisual } from '@/components/landing/landing-hook-visual'
import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'
import { cn } from '@/lib/utils'
import {
  LANDING_EVENT_CARD_GLOWS,
  LANDING_SPORTS,
  LANDING_SPORTS_DEFAULT_ID,
  getLandingSport,
  type LandingSportId,
} from '@/src/lib/landing-sports-events'

function LowPolyCardBackdrop({ accentRgb }: { accentRgb: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: [
            `linear-gradient(145deg, rgba(${accentRgb},0.22) 0%, transparent 48%)`,
            `linear-gradient(320deg, rgba(15,23,42,0.95) 20%, rgba(${accentRgb},0.12) 100%)`,
            `radial-gradient(ellipse 80% 60% at 85% 15%, rgba(${accentRgb},0.35) 0%, transparent 55%)`,
          ].join(', '),
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.35]"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,120 120,24 220,120"
          fill={`rgba(${accentRgb},0.18)`}
        />
        <polygon
          points="120,24 280,0 400,70 220,120"
          fill={`rgba(${accentRgb},0.1)`}
        />
        <polygon
          points="280,0 400,0 400,70"
          fill={`rgba(255,255,255,0.06)`}
        />
        <polygon points="0,0 120,24 0,80" fill={`rgba(0,0,0,0.25)`} />
      </svg>
    </div>
  )
}

/**
 * Single continuous post-hero showcase:
 * promise → phone + Pucky + floating balls → more sports → selector → cards → footer.
 *
 * Adjacent hues: top `#0d1520` → mid `#070b12` → features `#090f18`.
 */
export function LandingSportsSection() {
  const [selectedId, setSelectedId] = useState<LandingSportId>(
    LANDING_SPORTS_DEFAULT_ID,
  )
  const selected = getLandingSport(selectedId)

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden pt-28 md:pt-36"
      aria-labelledby="hook-heading"
      style={{
        background:
          'linear-gradient(to bottom, #0d1520 0%, #070b12 18%, #070b12 82%, #090f18 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 70% 45% at 50% 12%, rgba(0,230,118,0.12) 0%, transparent 55%)',
            'radial-gradient(ellipse 55% 40% at 50% 78%, rgba(59,130,246,0.07) 0%, transparent 50%)',
            'radial-gradient(ellipse 40% 30% at 18% 48%, rgba(245,158,11,0.05) 0%, transparent 50%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className="landing-hook-shape top-[14%] right-[8%] hidden h-24 w-24 rounded-full md:block"
      />
      <div
        aria-hidden
        className="landing-hook-shape bottom-[28%] left-[6%] hidden h-16 w-16 rotate-12 rounded-lg md:block"
      />

      <div className="relative z-[1] mx-auto max-w-6xl px-6">
        <ScrollRevealGroup className="flex flex-col items-center text-center">
          {/* 1. Promise */}
          <RevealItem index={0} className="w-full max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e676] sm:text-xs">
              One place for everything
            </p>
            <h2
              id="hook-heading"
              className="mt-4 font-display text-3xl leading-[1.15] tracking-wide text-[#f0f4f8] sm:text-4xl md:text-[2.6rem] md:leading-[1.12]"
            >
              Make Every Match Matter.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#728d9c] md:text-lg">
              Predict with your friends across the sports, leagues, and events
              you already love.
            </p>
          </RevealItem>

          {/* 2. Centerpiece — phone + peeking Pucky + floating balls */}
          <RevealItem index={1} className="mx-auto mt-10 w-full min-w-0 sm:mt-12">
            <LandingHookVisual />
          </RevealItem>

          {/* 3. Transition into sports */}
          <RevealItem index={2} className="mt-12 w-full sm:mt-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e676] sm:text-xs">
              More sports. More ways to play.
            </p>
          </RevealItem>

          {/* 4. Sport selector */}
          <RevealItem index={3} className="mt-6 w-full sm:mt-8">
            <div
              className={cn(
                '-mx-6 flex gap-2 overflow-x-auto overscroll-x-contain px-6 pb-2',
                'snap-x snap-mandatory scrollbar-none',
                'sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0',
              )}
              role="tablist"
              aria-label="Choose a sport"
            >
              {LANDING_SPORTS.map((sport) => {
                const active = sport.id === selectedId
                return (
                  <button
                    key={sport.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedId(sport.id)}
                    className={cn(
                      'snap-center inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/60',
                      active
                        ? 'border-[#00e676]/55 bg-[#00e676]/15 text-[#f0f4f8] shadow-[0_0_24px_rgba(0,230,118,0.35)]'
                        : 'border-white/10 bg-white/[0.03] text-[#a8b8c4] hover:border-white/20 hover:text-[#f0f4f8]',
                    )}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {sport.emoji}
                    </span>
                    <span>{sport.label}</span>
                  </button>
                )
              })}
            </div>
          </RevealItem>

          {/* 5. Event cards */}
          <RevealItem index={4} className="mt-6 w-full sm:mt-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3.5">
              {selected.events.map((event, index) => {
                const glow =
                  LANDING_EVENT_CARD_GLOWS[index] ?? LANDING_EVENT_CARD_GLOWS[0]!
                return (
                  <article
                    key={`${selected.id}-${event.id}`}
                    className="group relative overflow-hidden rounded-xl border border-white/12 text-left transition-transform duration-300 hover:-translate-y-0.5"
                    style={{
                      boxShadow: [
                        '0 10px 24px rgba(0,0,0,0.35)',
                        `0 0 24px rgba(${glow.glowRgb},0.16)`,
                      ].join(', '),
                    }}
                  >
                    <LowPolyCardBackdrop accentRgb={glow.glowRgb} />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(${glow.glowRgb},0.2) 0%, transparent 60%)`,
                      }}
                    />

                    <div className="relative z-[1] flex items-start gap-3 p-3.5 pr-14 sm:p-4 sm:pr-16">
                      <h3 className="min-w-0 flex-1 font-display text-lg leading-tight tracking-wide text-[#f0f4f8] sm:text-xl">
                        {event.name}
                      </h3>
                      <Image
                        src={selected.ballSrc}
                        alt=""
                        width={40}
                        height={40}
                        className="pointer-events-none absolute top-2.5 right-2.5 h-10 w-10 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] sm:top-3 sm:right-3 sm:h-11 sm:w-11"
                        aria-hidden
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
