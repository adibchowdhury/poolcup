"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { HeroBackgroundCarousel } from "@/components/landing/hero-background-carousel"
import { HeroConfetti } from "@/components/landing/hero-confetti"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { CoreFeaturesSection } from "@/components/landing/core-features-section"
import { LandingHookVisual } from "@/components/landing/landing-hook-visual"
import { PlatformTrustBar } from "@/components/landing/platform-trust-bar"
import { WaitlistForm } from "@/components/landing/waitlist-form"
import {
  RevealItem,
  ScrollRevealGroup,
} from "@/components/landing/scroll-reveal"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

function heroReveal(isVisible: boolean) {
  return cn(
    "transition-all duration-700 ease-out motion-reduce:transition-none",
    isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
  )
}

const ACCOUNT_DELETED_QUERY_PARAM = 'accountDeleted'
const ACCOUNT_DELETED_SESSION_KEY = 'poolcup_account_deleted'
const ACCOUNT_DELETED_BANNER_MS = 5000

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [accountDeletedMessage, setAccountDeletedMessage] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get(ACCOUNT_DELETED_QUERY_PARAM) === '1'
    const fromStorage =
      sessionStorage.getItem(ACCOUNT_DELETED_SESSION_KEY) === '1'

    if (!fromQuery && !fromStorage) return

    sessionStorage.removeItem(ACCOUNT_DELETED_SESSION_KEY)
    if (fromQuery) {
      window.history.replaceState(null, '', '/')
    }

    setAccountDeletedMessage(true)
  }, [])

  useEffect(() => {
    if (!accountDeletedMessage) return

    const timer = window.setTimeout(() => {
      setAccountDeletedMessage(false)
    }, ACCOUNT_DELETED_BANNER_MS)

    return () => window.clearTimeout(timer)
  }, [accountDeletedMessage])

  return (
    <div className="overflow-x-hidden bg-background">
      {accountDeletedMessage && (
        <div className="relative border-b border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-[#f0f4f8]">
          Your account has been deleted.
          <button
            type="button"
            onClick={() => setAccountDeletedMessage(false)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-[#f0f4f8]/80 transition-colors hover:text-[#f0f4f8]"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {/* ===== SECTION 1: HERO ===== */}
      <section className="relative min-h-screen overflow-hidden bg-background">
        <HeroBackgroundCarousel />
        <div className="pointer-events-none absolute inset-0 bg-background/70" aria-hidden />
        {/* Layered background */}
        <div className="hero-glow-layer hero-glow-primary" aria-hidden />
        <div className="hero-glow-layer hero-glow-secondary" aria-hidden />
        <div className="hero-glow-layer hero-vignette" aria-hidden />

        <HeroConfetti />

        {/* Noise texture */}
        <div className="hero-noise" aria-hidden />

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-transparent"
          aria-hidden
        />

        <LandingNavbar
          className={heroReveal(isVisible)}
          style={{ transitionDelay: "0ms" }}
        />

        {/* Hero Content */}
        <main
          id="main-content"
          className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-28 md:pt-24 md:pb-32"
        >
          <div className="flex flex-col items-center text-center">
            {/*
              Title + Pucky as one tight inline unit (not a full-width row).
              Pucky uses negative margin to cancel transparent padding in
              pucky_hero.png (~354px art inside a 500px canvas).
            */}
            <div
              className={cn(
                'inline-flex max-w-full flex-col items-center gap-4',
                'md:flex-row md:items-center md:gap-0',
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: '0ms' }}
            >
              <h1
                className={cn(
                  'shrink-0 font-display tracking-wide text-[#f0f4f8]',
                  'text-6xl leading-[0.92] sm:text-7xl',
                  'md:text-left md:text-8xl md:leading-[0.9]',
                  'lg:text-[6.75rem] lg:leading-[0.88]',
                )}
              >
                <span
                  className={cn('block', heroReveal(isVisible))}
                  style={{ transitionDelay: '0ms' }}
                >
                  YOUR SQUAD.
                </span>
                <span
                  className={cn('block', heroReveal(isVisible))}
                  style={{ transitionDelay: '100ms' }}
                >
                  YOUR POOL.
                </span>
                <span
                  className={cn(
                    'block text-[#00e676]',
                    heroReveal(isVisible),
                    isVisible && 'hero-glory-glow',
                  )}
                  style={{ transitionDelay: '200ms' }}
                >
                  YOUR GLORY.
                </span>
              </h1>

              <div
                className={cn(
                  'relative shrink-0',
                  /* Mobile: smaller so title + waitlist aren't crowded */
                  'w-[min(48vw,11rem)] sm:w-[13rem]',
                  /* Desktop: keep current prominence */
                  'md:w-[20rem] md:-ml-10',
                  'lg:w-[22rem] lg:-ml-12',
                  'xl:w-[24rem] xl:-ml-14',
                  heroReveal(isVisible),
                )}
                style={{ transitionDelay: '180ms' }}
              >
                <Image
                  src="/mascot/pucky_hero.png"
                  alt="Pucky the PoolCup mascot holding a trophy overhead"
                  width={500}
                  height={500}
                  priority
                  className="h-auto w-full bg-transparent object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                  sizes="(max-width: 640px) 11rem, (max-width: 768px) 13rem, (max-width: 1024px) 20rem, 24rem"
                />
              </div>
            </div>

            <p
              className={cn(
                'mx-auto mt-8 max-w-xl text-lg leading-relaxed text-[#f0f4f8] md:mt-10 md:text-xl',
                heroReveal(isVisible),
              )}
              style={{
                transitionDelay: '300ms',
                textShadow: '0 1px 12px rgba(0,0,0,0.9)',
              }}
            >
              Create prediction pools for the biggest sporting events of the year.
              Track scores, climb leaderboards, and settle bragging rights.
            </p>

            <div
              className={cn(
                'mx-auto mt-8 w-full max-w-xl md:mt-10',
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: '400ms' }}
            >
              <WaitlistForm id="waitlist" variant="hero" />
            </div>
          </div>
        </main>
      </section>

      <PlatformTrustBar />

      {/* ===== POST-HERO HOOK ===== */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-[#0d1520] pt-28 pb-20 md:pt-36 md:pb-28"
        aria-labelledby="hook-heading"
      >
        {/* Faint depth — gradients + light geometry only (no blur/filters) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_20%,rgba(0,230,118,0.07)_0%,transparent_55%),radial-gradient(ellipse_60%_50%_at_90%_75%,rgba(59,130,246,0.05)_0%,transparent_50%)]"
        />
        <div
          aria-hidden
          className="landing-hook-shape top-[18%] right-[8%] hidden h-24 w-24 rounded-full md:block"
        />
        <div
          aria-hidden
          className="landing-hook-shape bottom-[22%] left-[6%] hidden h-16 w-16 rotate-12 rounded-lg md:block"
        />
        <div
          aria-hidden
          className="landing-hook-shape top-[42%] left-[42%] hidden h-10 w-10 -rotate-6 rounded-md border-[rgba(255,255,255,0.06)] md:block"
        />

        <div className="relative z-[1] mx-auto max-w-7xl px-6">
          <ScrollRevealGroup className="flex flex-col gap-10 md:grid md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)] md:items-center md:gap-6 lg:gap-8 xl:gap-10">
            <div className="text-center md:text-left">
              <RevealItem index={0}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e676] sm:text-xs">
                  One place for everything
                </p>
              </RevealItem>
              <RevealItem index={1}>
                <h2
                  id="hook-heading"
                  className="mt-4 font-display text-3xl leading-[1.15] tracking-wide text-[#f0f4f8] sm:text-4xl md:text-[2.6rem] md:leading-[1.12]"
                >
                  Make Every Match Matter.
                </h2>
              </RevealItem>
              <RevealItem index={2}>
                <p className="mt-5 text-base leading-relaxed text-[#728d9c] md:text-lg">
                  Predict matches with your friends and let PoolCup handle the
                  rest — live scoring, instant leaderboards, and the bragging
                  rights to back it up.
                </p>
              </RevealItem>
            </div>

            <RevealItem index={3} className="mx-auto w-full min-w-0">
              <LandingHookVisual />
            </RevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      <CoreFeaturesSection />

      <SiteFooter backgroundClass="bg-[#0d1520]" />
    </div>
  )
}
