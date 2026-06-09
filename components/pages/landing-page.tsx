"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useClientNow } from "@/hooks/use-client-now"
import { FeatureTabsSection } from "@/components/landing/feature-tabs-section"
import { SportsSection } from "@/components/landing/sports-section"
import { HeroConfetti } from "@/components/landing/hero-confetti"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

function heroReveal(isVisible: boolean) {
  return cn(
    "transition-all duration-700 ease-out motion-reduce:transition-none",
    isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
  )
}

const WORLD_CUP_KICKOFF_UTC_MS = Date.UTC(2026, 5, 11)

function getHeroDaysStat(mounted: boolean, nowMs: number) {
  if (!mounted || nowMs <= 0) {
    return { value: "—", accent: false }
  }

  const now = new Date(nowMs)
  const todayStartUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )

  if (todayStartUtc >= WORLD_CUP_KICKOFF_UTC_MS) {
    return { value: "LIVE", accent: true }
  }

  const daysRemaining = Math.ceil(
    (WORLD_CUP_KICKOFF_UTC_MS - todayStartUtc) / (24 * 60 * 60 * 1000),
  )

  return { value: String(daysRemaining), accent: false }
}

const scoringStyles = [
  { id: "winner", label: "Winner Only" },
  { id: "classic", label: "Score Predictor" },
]

const matchesData = [
  { id: 1, team1: "Mexico", flag1: "🇲🇽", team2: "S.Africa", flag2: "🇿🇦", score1: "2", score2: "1", completed: true },
  { id: 2, team1: "Brazil", flag1: "🇧🇷", team2: "Argentina", flag2: "🇦🇷", score1: "", score2: "", completed: false },
  { id: 3, team1: "England", flag1: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", team2: "France", flag2: "🇫🇷", score1: "", score2: "", completed: false },
]

const leaderboardData = [
  { rank: 4, name: "Alex", points: 112, correct: "19/32", change: 2, isYou: true },
  { rank: 5, name: "Chris", points: 98, correct: "16/32", change: -1 },
  { rank: 6, name: "Priya", points: 91, correct: "15/32", change: 0 },
]

const joinMembers = [
  { name: "Jordan", role: "Creator", initial: "J" },
  { name: "Sarah", initial: "S" },
  { name: "Mike", initial: "M" },
  { name: "Alex", initial: "A", isNew: true },
]

export default function LandingPage() {
  const [selectedStyle, setSelectedStyle] = useState("classic")
  const [isVisible, setIsVisible] = useState(false)
  const { mounted, nowMs } = useClientNow(null)

  const daysStat = useMemo(
    () => getHeroDaysStat(mounted, nowMs),
    [mounted, nowMs],
  )

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="bg-[#080b0f]">
      {/* ===== SECTION 1: HERO ===== */}
      <section className="relative min-h-screen overflow-hidden bg-[#080b0f]">
        <div
          className="absolute inset-0 bg-[url('/background.png')] bg-cover bg-center bg-no-repeat"
          aria-hidden
        />
        <div className="absolute inset-0 bg-[#080b0f]/70" aria-hidden />
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
          className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-20"
        >
          <div className="text-center">
            <p
              className={cn(
                'mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white md:mb-6',
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: '0ms' }}
            >
              World Cup 2026 · June 11 — July 19
            </p>

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
              World Cup 2026 kicks off June 11. Create a private prediction pool and lock
              your friends, family, or coworkers in before the first whistle.
            </p>

            <div
              className={cn(
                "mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row md:mt-10",
                heroReveal(isVisible),
              )}
              style={{ transitionDelay: "400ms" }}
            >
              <Link
                href="/login"
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

          {/* Stats row */}
          <div className="mt-16 border-t border-[rgba(255,255,255,0.08)] pt-8 md:mt-24">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-8">
              {[
                { value: "104", label: "Matches", accent: false, delay: 500 },
                { value: "48", label: "Nations", accent: false, delay: 600 },
                {
                  value: daysStat.value,
                  label: "Days",
                  accent: daysStat.accent,
                  delay: 700,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn("text-center", heroReveal(isVisible))}
                  style={{ transitionDelay: `${stat.delay}ms` }}
                >
                  <div
                    className={cn(
                      "font-display text-4xl md:text-5xl",
                      stat.accent ? "text-[#00e676]" : "text-[#f0f4f8]",
                    )}
                  >
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-[#f0f4f8]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </section>

      {/* ===== SECTION 2: HOW IT WORKS (quick 3 steps) ===== */}
      <section id="how-it-works" className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-4xl md:text-5xl text-[#f0f4f8] text-center mb-16">HOW IT WORKS</h2>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="text-center md:text-left">
              <div className="font-display text-6xl md:text-7xl text-[#00e676] mb-4">01</div>
              <div className="w-14 h-14 rounded-2xl bg-[#00e676]/10 flex items-center justify-center mb-4 mx-auto md:mx-0">
                <svg className="w-7 h-7 text-[#00e676]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-[#f0f4f8] mb-2">CREATE YOUR POOL</h3>
              <p className="text-muted-on-section leading-relaxed">Name your pool, pick a scoring style, and get a shareable invite link in seconds.</p>
            </div>

            {/* Step 2 */}
            <div className="text-center md:text-left">
              <div className="font-display text-6xl md:text-7xl text-[#00e676] mb-4">02</div>
              <div className="w-14 h-14 rounded-2xl bg-[#00e676]/10 flex items-center justify-center mb-4 mx-auto md:mx-0">
                <svg className="w-7 h-7 text-[#00e676]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-[#f0f4f8] mb-2">INVITE YOUR SQUAD</h3>
              <p className="text-muted-on-section leading-relaxed">Share the link. Friends join free — no account, no app download needed.</p>
            </div>

            {/* Step 3 */}
            <div className="text-center md:text-left">
              <div className="font-display text-6xl md:text-7xl text-[#00e676] mb-4">03</div>
              <div className="w-14 h-14 rounded-2xl bg-[#00e676]/10 flex items-center justify-center mb-4 mx-auto md:mx-0">
                <svg className="w-7 h-7 text-[#00e676]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-[#f0f4f8] mb-2">PREDICT & COMPETE</h3>
              <p className="text-muted-on-section leading-relaxed">Everyone predicts match scores. The app tracks points and updates the leaderboard automatically.</p>
            </div>
          </div>
        </div>
      </section>

      <SportsSection />

      {/* ===== CREATE YOUR POOL ===== */}
      <section className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* UI Preview - Left */}
            <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 md:p-8">
              <div className="max-w-sm mx-auto">
                {/* Pool Name */}
                <div className="mb-5">
                  <label className="block text-[#5a7080] text-xs uppercase tracking-wider mb-2">Pool Name</label>
                  <input
                    type="text"
                    defaultValue="Marketing Team WC 2026"
                    readOnly
                    className="w-full bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[#f0f4f8] focus:outline-none"
                  />
                </div>

                {/* Scoring Style */}
                <div className="mb-5">
                  <label className="block text-[#5a7080] text-xs uppercase tracking-wider mb-2">Scoring Style</label>
                  <div className="flex gap-2">
                    {scoringStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                          selectedStyle === style.id
                            ? "border-2 border-[#00e676] text-[#00e676] bg-[#00e676]/5"
                            : "border border-[rgba(255,255,255,0.08)] text-[#5a7080] hover:text-[#f0f4f8]"
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <Link href="/login" className="w-full bg-[#00e676] text-[#080b0f] py-4 rounded-lg font-semibold text-base hover:bg-[#00e676]/90 transition-all flex items-center justify-center gap-2">
                  Create Pool
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Text - Right */}
            <div>
              <h3 className="font-display text-3xl md:text-4xl text-[#f0f4f8] mb-4">Create your pool in 60 seconds</h3>
              <p className="text-[#5a7080] text-lg leading-relaxed mb-8">
                Name it, choose a scoring style, and get a private invite link instantly — no complicated setup, no recurring fees.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Free to create
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Instant invite link
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Full 104-match tournament
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited members
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INVITE YOUR SQUAD ===== */}
      <section className="relative py-24 md:py-32 bg-[#080b0f]">
        <div
          className="pointer-events-none absolute z-[1] hidden md:block md:top-[48%] md:left-[max(1.5rem,calc((100%-80rem)/2+0.25rem))] lg:top-[11rem] lg:left-[max(1.5rem,calc((100%-80rem)/2+0.25rem))]"
          aria-hidden
        >
          <div className="animate-float">
            <Image
              src="/paper_plane.png"
              alt=""
              width={120}
              height={78}
              className="h-auto w-[120px]"
            />
          </div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text - Left */}
            <div className="order-2 lg:order-1">
              <h3 className="font-display text-3xl md:text-4xl text-[#f0f4f8] mb-4">Share a link. That&apos;s it.</h3>
              <p className="text-[#5a7080] text-lg leading-relaxed mb-8">
                Your friends, coworkers, or Discord server just click the link and enter their name. No account required. No app to download. They&apos;re in within 10 seconds.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No sign-up for members
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Works on any phone
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Join from anywhere
                </li>
              </ul>
            </div>

            {/* UI Preview - Right */}
            <div className="order-1 lg:order-2 bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
              {/* Pool Banner */}
              <div className="bg-gradient-to-r from-[#00e676]/20 to-[#00e676]/5 p-6 border-b border-[rgba(255,255,255,0.08)]">
                <div className="font-display text-2xl text-[#f0f4f8] tracking-wide">MARKETING TEAM WC 2026</div>
                <div className="text-[#5a7080] text-sm mt-1">4 members · Created by Jordan</div>
              </div>
              
              <div className="p-6">
                {/* Name Input */}
                <div className="mb-4">
                  <label className="block text-[#5a7080] text-xs uppercase tracking-wider mb-2">Your Name</label>
                  <input
                    type="text"
                    defaultValue="Alex"
                    readOnly
                    className="w-full bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[#f0f4f8] focus:outline-none"
                  />
                </div>
                
                <button className="w-full bg-[#00e676] text-[#080b0f] py-3 rounded-lg font-semibold mb-6">
                  Join Pool
                </button>
                
                {/* Member List */}
                <div className="space-y-2">
                  {joinMembers.map((member, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        member.isNew ? "bg-[#00e676]/10 border border-[#00e676]/30" : "bg-[#1a2535]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                        member.isNew ? "bg-[#00e676] text-[#080b0f]" : "bg-[#0d1520] text-[#f0f4f8]"
                      }`}>
                        {member.initial}
                      </div>
                      <span className={`font-medium ${member.isNew ? "text-[#00e676]" : "text-[#f0f4f8]"}`}>
                        {member.name}
                      </span>
                      {member.role && <span className="text-[#5a7080] text-xs ml-auto">{member.role}</span>}
                      {member.isNew && <span className="text-[#00e676] text-xs ml-auto">Just joined!</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PREDICT EVERY MATCH ===== */}
      <section className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* UI Preview - Left */}
            <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
              {/* Lock warning */}
              <div className="flex items-center justify-center gap-2 bg-[#ffb300]/10 text-[#ffb300] px-4 py-2 rounded-lg text-sm font-medium mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Matches lock in 2h
              </div>
              
              {/* Match Cards */}
              <div className="space-y-3 mb-4">
                {matchesData.map((match) => (
                  <div
                    key={match.id}
                    className="bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xl">{match.flag1}</span>
                        <span className="text-[#f0f4f8] font-medium text-sm">{match.team1}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`w-12 h-11 rounded-md flex items-center justify-center font-display text-xl ${
                          match.completed
                            ? "bg-[#00e676]/15 border-2 border-[#00e676] text-[#00e676]"
                            : "bg-[#0d1318] border border-[rgba(255,255,255,0.15)] text-[#5a7080]"
                        }`}>
                          {match.score1 || "–"}
                        </div>
                        <span className="text-[#5a7080] text-lg">:</span>
                        <div className={`w-12 h-11 rounded-md flex items-center justify-center font-display text-xl ${
                          match.completed
                            ? "bg-[#00e676]/15 border-2 border-[#00e676] text-[#00e676]"
                            : "bg-[#0d1318] border border-[rgba(255,255,255,0.15)] text-[#5a7080]"
                        }`}>
                          {match.score2 || "–"}
                        </div>
                        {match.completed && (
                          <div className="w-6 h-6 rounded-full bg-[#00e676] flex items-center justify-center ml-1">
                            <svg className="w-3.5 h-3.5 text-[#080b0f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-[#f0f4f8] font-medium text-sm">{match.team2}</span>
                        <span className="text-xl">{match.flag2}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Save Button */}
              <button className="w-full bg-[#00e676] text-[#080b0f] py-3 rounded-lg font-semibold">
                Save Predictions
              </button>
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
      <section className="py-24 md:py-32 bg-[#080b0f]">
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

            {/* UI Preview - Right */}
            <div className="order-1 lg:order-2 bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
              {/* Podium */}
              <div className="flex items-end justify-center gap-3 mb-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#1a2535] flex items-center justify-center font-semibold text-[#f0f4f8] mb-1">S</div>
                  <div className="text-[#f0f4f8] font-medium text-sm">Sarah</div>
                  <div className="font-display text-lg text-[#f0f4f8]">142</div>
                  <div className="w-12 h-14 bg-gradient-to-t from-[#C0C0C0]/20 to-[#C0C0C0]/5 rounded-t-lg mt-1 flex items-start justify-center pt-1">
                    <span className="bg-[#C0C0C0] text-[#080b0f] text-xs font-bold px-1.5 py-0.5 rounded">2</span>
                  </div>
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center -mt-4">
                  <div className="w-14 h-14 rounded-full bg-[#1a2535] border-2 border-[#00e676] flex items-center justify-center font-semibold text-[#f0f4f8] mb-1">J</div>
                  <div className="text-[#f0f4f8] font-medium">Jordan</div>
                  <div className="font-display text-xl text-[#00e676]">167</div>
                  <div className="w-14 h-20 bg-gradient-to-t from-[#00e676]/20 to-[#00e676]/5 border-2 border-[#00e676] rounded-t-lg mt-1 flex items-start justify-center pt-1">
                    <span className="bg-[#00e676] text-[#080b0f] text-xs font-bold px-1.5 py-0.5 rounded">1</span>
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#1a2535] flex items-center justify-center font-semibold text-[#f0f4f8] mb-1">T</div>
                  <div className="text-[#f0f4f8] font-medium text-sm">Tyler</div>
                  <div className="font-display text-lg text-[#f0f4f8]">128</div>
                  <div className="w-12 h-10 bg-gradient-to-t from-[#5a7080]/20 to-[#5a7080]/5 rounded-t-lg mt-1 flex items-start justify-center pt-1">
                    <span className="bg-[#5a7080] text-[#080b0f] text-xs font-bold px-1.5 py-0.5 rounded">3</span>
                  </div>
                </div>
              </div>

              {/* Rankings List */}
              <div className="space-y-2">
                {leaderboardData.map((player, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.isYou ? "bg-[#00e676]/10 border border-[#00e676]/30" : "bg-[#1a2535]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[#5a7080] w-4 text-sm">{player.rank}</span>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs ${
                        player.isYou ? "bg-[#00e676] text-[#080b0f]" : "bg-[#0d1520] text-[#f0f4f8]"
                      }`}>
                        {player.name.charAt(0)}
                      </div>
                      <span className={`font-medium text-sm ${player.isYou ? "text-[#00e676]" : "text-[#f0f4f8]"}`}>
                        {player.name}
                      </span>
                      {player.isYou && <span className="text-[#00e676] text-xs">(you)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-mono ${
                        player.change > 0 ? "text-[#00e676]" : player.change < 0 ? "text-[#ff4444]" : "text-[#5a7080]"
                      }`}>
                        {player.change > 0 ? `↑${player.change}` : player.change < 0 ? `↓${Math.abs(player.change)}` : "—"}
                      </div>
                      <div className="font-display text-base text-[#f0f4f8]">{player.points}<span className="text-[#5a7080] text-xs font-sans ml-0.5">pts</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeatureTabsSection />

      {/* ===== FINAL CTA ===== */}
      <section id="cta" className="relative overflow-hidden bg-[#080b0f] py-24 md:py-32">
        {/* Background glow */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,230,118,0.08) 0%, transparent 60%)"
          }}
        />

        <Image
          src="/cheerleader.png"
          alt=""
          width={280}
          height={420}
          className="pointer-events-none absolute left-[calc(50%-38.5rem)] top-1/2 z-[1] hidden h-[280px] w-auto -translate-y-1/2 lg:block"
          aria-hidden
        />
        
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[#f0f4f8] mb-4">THE TOURNAMENT STARTS JUNE 11.</h2>
          <p className="text-[#5a7080] text-xl mb-10">Your pool won&apos;t create itself.</p>
          
          <Link href="/login" className="bg-[#00e676] text-[#080b0f] px-10 py-5 rounded-xl font-semibold text-lg hover:bg-[#00e676]/90 transition-all hover:scale-[1.02] inline-flex items-center gap-2">
            Create a Pool
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          
          <p className="mt-6 text-[#5a7080] text-sm">Takes 60 seconds · Free to use · No subscription</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
