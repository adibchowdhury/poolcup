"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { HeroBackgroundCarousel } from "@/components/landing/hero-background-carousel"
import { HeroConfetti } from "@/components/landing/hero-confetti"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { CoreFeaturesSection } from "@/components/landing/core-features-section"
import { LandingFinalCtaSection } from "@/components/landing/landing-final-cta-section"
import { LandingSportsSection } from "@/components/landing/landing-sports-section"
import { PlatformTrustBar } from "@/components/landing/platform-trust-bar"
import { WaitlistForm } from "@/components/landing/waitlist-form"
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

const HERO_SPORT_IMAGES = [
  '/sports/soccer.png',
  '/sports/basketball.png',
  '/sports/baseball.png',
  '/sports/football.png',
  '/sports/cricket.png',
] as const

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
          className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-28 md:pb-32"
        >
          <div className="text-center">
            <h1 className="font-display text-5xl leading-[0.95] tracking-wide md:text-7xl lg:text-8xl">
              <span
                className={cn("block text-[#f0f4f8]", heroReveal(isVisible))}
                style={{ transitionDelay: "0ms" }}
              >
                YOUR SQUAD.
              </span>
              <span
                className={cn("block text-[#f0f4f8]", heroReveal(isVisible))}
                style={{ transitionDelay: "100ms" }}
              >
                YOUR POOL.
              </span>
              <span
                className={cn(
                  "block text-[#00e676]",
                  heroReveal(isVisible),
                  isVisible && "hero-glory-glow",
                )}
                style={{ transitionDelay: "200ms" }}
              >
                YOUR GLORY.
              </span>
            </h1>

            <div
              className={cn(
                "mt-6 flex items-center justify-center md:mt-8",
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: "250ms" }}
            >
              {HERO_SPORT_IMAGES.map((src, index) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={128}
                  height={128}
                  className={cn(
                    "h-20 w-20 object-contain md:h-28 md:w-28 lg:h-32 lg:w-32",
                    index > 0 && "-ml-10 md:-ml-14 lg:-ml-16",
                  )}
                  style={{ zIndex: index }}
                  aria-hidden
                />
              ))}
            </div>

            <p
              className={cn(
                "mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#f0f4f8] md:mt-8 md:text-xl",
                heroReveal(isVisible),
              )}
              style={{
                transitionDelay: "300ms",
                textShadow: "0 1px 12px rgba(0,0,0,0.9)",
              }}
            >
              Create prediction pools for the biggest sporting events of the year.
              Track scores, climb leaderboards, and settle bragging rights.
            </p>

            <div
              className={cn(
                "mx-auto mt-8 w-full max-w-xl md:mt-10",
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: "400ms" }}
            >
              <WaitlistForm id="waitlist" variant="hero" />
            </div>
          </div>
        </main>
      </section>

      <PlatformTrustBar />

      <LandingSportsSection />

      <CoreFeaturesSection />

      <LandingFinalCtaSection />

      <SiteFooter backgroundClass="bg-[#0d1520]" />
    </div>
  )
}
