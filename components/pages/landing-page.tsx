"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { HeroBackgroundCarousel } from "@/components/landing/hero-background-carousel"
import { HeroConfetti } from "@/components/landing/hero-confetti"
import { HowItWorksDemo } from "@/components/home/how-it-works-demo"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { JoinTheActionSection } from "@/components/landing/join-the-action-section"
import { LandingLeaderboardPreview } from "@/components/landing/landing-leaderboard-preview"
import { LandingMatchPredictionPreview } from "@/components/landing/landing-match-prediction-preview"
import { LandingPricingSection } from "@/components/landing/landing-pricing-section"
import { PlatformTrustBar } from "@/components/landing/platform-trust-bar"
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
                "mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row md:mt-10",
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: "400ms" }}
            >
              <Link
                href="/login?next=/create"
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#00e676] px-8 py-4 text-lg font-semibold text-[#080b0f] transition-all hover:scale-[1.03] hover:bg-[#00e676]/90 hover:shadow-[0_0_32px_rgba(0,230,118,0.4)] active:scale-95 sm:w-auto"
              >
                Create a Pool
                <svg
                  className="h-5 w-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="w-full rounded-lg border-[1.5px] border-[rgba(255,255,255,0.6)] px-8 py-4 text-lg font-semibold text-white transition-all hover:scale-[1.03] hover:border-[rgba(0,230,118,0.3)] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_0_24px_rgba(255,255,255,0.06)] active:scale-95 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>
        </main>
      </section>

      <PlatformTrustBar />

      {/* ===== SECTION 2: JOIN THE ACTION (experience preview) ===== */}
      <JoinTheActionSection />

      {/* ===== SECTION 3: HOW IT WORKS ===== */}
      <section id="how-it-works" className="bg-[#0d1520] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-center md:gap-10 lg:gap-12">
            <div className="text-center md:text-left">
              <h2 className="font-display text-5xl md:text-6xl text-[#f0f4f8]">
                HOW IT WORKS
              </h2>
              <p className="mt-3 text-base text-[#728d9c] leading-relaxed md:text-xl">
                Spin up a pool in three steps. Try it right here.
              </p>
              <ol className="mt-6 space-y-4 text-left">
                {[
                  {
                    title: 'Create your pool',
                    description:
                      'Name your pool, pick a scoring style, and get a shareable invite link in seconds.',
                  },
                  {
                    title: 'Invite your squad',
                    description:
                      'Share the link. Friends sign up free in seconds, no app to download.',
                  },
                  {
                    title: 'Predict and compete',
                    description:
                      'Everyone predicts match scores. The app tracks points and updates the leaderboard automatically.',
                  },
                ].map((item, index) => (
                  <li key={item.title} className="flex gap-4">
                    <span
                      className="font-display shrink-0 text-3xl leading-none tracking-[0.1em] text-[#00e676]"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-display text-2xl tracking-[0.06em] text-[#f0f4f8]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-base text-[#728d9c] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="w-full max-w-lg mx-auto md:mx-0 md:ml-auto">
              <HowItWorksDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ===== PREDICT EVERY MATCH ===== */}
      <section className="py-24 md:py-32 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Real prediction card preview (static — local score state only) */}
            <div>
              <LandingMatchPredictionPreview />
            </div>

            {/* Text - Right */}
            <div>
              <h3 className="font-display text-3xl md:text-4xl text-[#f0f4f8] mb-4">Predict scores before kickoff.</h3>
              <p className="text-[#5a7080] text-lg leading-relaxed mb-8">
                Everyone in your pool predicts the score for each match. Predictions lock automatically when the match kicks off — no cheating, no manual management.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Scores lock at kickoff automatically
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Predict winner or exact score
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Knockout matches worth more points
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Works on mobile
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LIVE LEADERBOARD ===== */}
      <section className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text - Left */}
            <div className="order-2 lg:order-1">
              <h3 className="font-display text-3xl md:text-4xl text-[#f0f4f8] mb-4">Watch the standings shake after every match.</h3>
              <p className="text-[#5a7080] text-lg leading-relaxed mb-8">
                The leaderboard updates the moment a final whistle blows. No spreadsheets, no manual calculation, no arguments about who got what right.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Updates automatically after each match
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Movement arrows show who&apos;s climbing
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Shareable link for the whole group
                </li>
              </ul>
            </div>

            {/* Real redesigned leaderboard preview (static example — no polling) */}
            <div className="order-1 lg:order-2">
              <LandingLeaderboardPreview />
            </div>
          </div>
        </div>
      </section>

      <LandingPricingSection />

      <SiteFooter backgroundClass="bg-[#0d1520]" />
    </div>
  )
}
