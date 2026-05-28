"use client"

import Link from "next/link"
import { useState } from "react"
import { SiteFooter } from "@/components/site-footer"

const scoringStyles = [
  { id: "classic", label: "Classic" },
  { id: "winner", label: "Winner only" },
  { id: "exact", label: "Exact score" },
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

  return (
    <div className="bg-[#080b0f]">
      {/* ===== SECTION 1: HERO ===== */}
      <section className="min-h-screen relative overflow-hidden">
        {/* Background Green Radial Glow from top */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,230,118,0.06) 0%, transparent 60%)"
          }}
        />
        
        {/* Football Pitch Line Art Pattern */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1200 800" 
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="600" cy="400" r="120" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <circle cx="600" cy="400" r="4" fill="rgba(0,230,118,0.04)" />
          <line x1="600" y1="100" x2="600" y2="700" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <rect x="50" y="250" width="180" height="300" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <rect x="50" y="320" width="70" height="160" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <path d="M 230 340 A 60 60 0 0 1 230 460" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <rect x="970" y="250" width="180" height="300" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <rect x="1080" y="320" width="70" height="160" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <path d="M 970 340 A 60 60 0 0 0 970 460" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
          <rect x="50" y="100" width="1100" height="600" fill="none" stroke="rgba(0,230,118,0.04)" strokeWidth="2" />
        </svg>
        
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="font-display text-2xl text-[#00e676] tracking-wider">POOLCUP</div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[#5a7080] hover:text-[#f0f4f8] transition-colors text-sm">How it works</a>
            <a href="#pricing" className="text-[#5a7080] hover:text-[#f0f4f8] transition-colors text-sm">Pricing</a>
            <a href="#features" className="text-[#5a7080] hover:text-[#f0f4f8] transition-colors text-sm">Features</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/create-account"
              className="rounded-lg border border-[rgba(255,255,255,0.2)] px-4 py-2 text-sm font-semibold text-[#f0f4f8] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#00e676] px-4 py-2 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90"
            >
              Sign in
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-20">
          <div className="text-center">
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-wide">
              <span className="block text-[#f0f4f8]">YOUR SQUAD.</span>
              <span className="block text-[#f0f4f8]">YOUR POOL.</span>
              <span className="block text-[#00e676]">YOUR GLORY.</span>
            </h1>

            <p className="mt-6 md:mt-8 text-[#5a7080] text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
              Create a private prediction pool for your office, group chat, or Discord. Everyone predicts, the app keeps score.
            </p>

            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="w-full sm:w-auto bg-[#00e676] text-[#080b0f] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#00e676]/90 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                Create a Pool
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <a href="#how-it-works" className="w-full sm:w-auto border border-[rgba(255,255,255,0.2)] text-[#f0f4f8] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[rgba(255,255,255,0.05)] transition-all">
                See how it works
              </a>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-16 md:mt-24 border-t border-[rgba(255,255,255,0.08)] pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl text-[#f0f4f8]">104</div>
                <div className="text-[#5a7080] text-sm mt-1">Matches</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl text-[#f0f4f8]">48</div>
                <div className="text-[#5a7080] text-sm mt-1">Nations</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl text-[#f0f4f8]">39</div>
                <div className="text-[#5a7080] text-sm mt-1">Days</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl text-[#00e676]">$15</div>
                <div className="text-[#5a7080] text-sm mt-1">Per Pool</div>
              </div>
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
              <p className="text-[#5a7080] leading-relaxed">Pay $15, name your pool, get a shareable invite link in seconds.</p>
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
              <p className="text-[#5a7080] leading-relaxed">Share the link. Friends join free — no account, no app download needed.</p>
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
              <p className="text-[#5a7080] leading-relaxed">Everyone predicts match scores. The app tracks points and updates the leaderboard automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CREATE YOUR POOL ===== */}
      <section id="features" className="py-24 md:py-32 bg-[#080b0f]">
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

                {/* Paywall Banner */}
                <div className="bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-[#ffb300]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#ffb300]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[#f0f4f8] font-semibold text-sm">Unlock full pool</div>
                    <div className="text-[#5a7080] text-xs">Unlimited members · Full tournament</div>
                  </div>
                  <div className="font-display text-3xl text-[#00e676]">$15</div>
                </div>

                {/* CTA Button */}
                <Link href="/login" className="w-full bg-[#00e676] text-[#080b0f] py-4 rounded-lg font-semibold text-base hover:bg-[#00e676]/90 transition-all flex items-center justify-center gap-2">
                  Pay $15 & Create Pool
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
                Name it, choose a scoring style, pay once. You get a private invite link instantly — no complicated setup, no recurring fees.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  One-time $15 payment
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
      <section className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
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
      <section className="py-24 md:py-32 bg-[#080b0f]">
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

      {/* ===== MATCH RESULTS ===== */}
      <section className="py-24 md:py-32 bg-[#080b0f]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* UI Preview - Left */}
            <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
              {/* Match Score Header */}
              <div className="p-6 text-center border-b border-[rgba(255,255,255,0.08)]">
                <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-3">Final Result</div>
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-1">🇧🇷</span>
                    <span className="text-[#f0f4f8] font-medium">Brazil</span>
                  </div>
                  <div className="font-display text-6xl text-[#f0f4f8]">2 — 1</div>
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-1">🇦🇷</span>
                    <span className="text-[#f0f4f8] font-medium">Argentina</span>
                  </div>
                </div>
              </div>
              
              {/* Your Prediction Result */}
              <div className="p-4 bg-[#00e676]/10 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-1">Your Prediction</div>
                    <div className="text-[#f0f4f8] font-medium">Brazil 2 — 1 Argentina</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-[#00e676]">+5</div>
                    <div className="text-[#00e676] text-xs font-medium">Exact score!</div>
                  </div>
                </div>
              </div>
              
              {/* Goalscorers */}
              <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-2">Goalscorers</div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-[#f0f4f8]">
                    <span className="text-[#5a7080] font-mono w-8">23&apos;</span>
                    <span>Rodrygo</span>
                    <span className="text-[#5a7080]">🇧🇷</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#f0f4f8]">
                    <span className="text-[#5a7080] font-mono w-8">57&apos;</span>
                    <span>Álvarez</span>
                    <span className="text-[#5a7080]">🇦🇷</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#f0f4f8]">
                    <span className="text-[#5a7080] font-mono w-8">78&apos;</span>
                    <span>Endrick</span>
                    <span className="text-[#5a7080]">🇧🇷</span>
                  </div>
                </div>
              </div>
              
              {/* Pool Reactions */}
              <div className="p-4">
                <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-2">Pool Reactions</div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-[#1a2535] px-3 py-1.5 rounded-full text-sm text-[#f0f4f8]">🔥 Jordan got it too!</span>
                  <span className="bg-[#1a2535] px-3 py-1.5 rounded-full text-sm text-[#f0f4f8]">😤 Mike missed</span>
                </div>
              </div>
            </div>

            {/* Text - Right */}
            <div>
              <h3 className="font-display text-3xl md:text-4xl text-[#f0f4f8] mb-4">Every result is a moment.</h3>
              <p className="text-[#5a7080] text-lg leading-relaxed mb-8">
                After each match you see exactly how you did, how many points you earned, and how your pool reacted. Getting an exact score right feels incredible.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Exact score = 5 points
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Correct winner = 2 points
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  See how your whole pool predicted
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 md:py-32 bg-[#0d1520]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-md mx-auto">
            {/* Single Pricing Card */}
            <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 md:p-10 text-center">
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="font-display text-6xl md:text-7xl text-[#00e676]">$15</span>
                <span className="text-[#5a7080] text-lg">one-time</span>
              </div>
              <p className="text-[#5a7080] text-base mb-8">
                Everything included. No tiers, no upgrades, no monthly fees.
              </p>
              
              <ul className="space-y-3 mb-8 text-left">
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited members
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Full tournament — all 104 matches
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Live leaderboard
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Automatic scoring
                </li>
                <li className="flex items-center gap-3 text-[#f0f4f8]">
                  <svg className="w-5 h-5 text-[#00e676] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Prediction reminders before each match
                </li>
              </ul>
              
              <Link href="/login" className="w-full bg-[#00e676] text-[#080b0f] py-4 rounded-lg font-semibold text-lg hover:bg-[#00e676]/90 transition-all flex items-center justify-center gap-2">
                Create a Pool
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            
            <p className="text-[#5a7080] text-sm text-center mt-6">
              Less than one round of drinks for 39 days of office drama.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section id="cta" className="py-24 md:py-32 bg-[#080b0f] relative overflow-hidden">
        {/* Background glow */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,230,118,0.08) 0%, transparent 60%)"
          }}
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
          
          <p className="mt-6 text-[#5a7080] text-sm">Takes 60 seconds · $15 one-time · No subscription</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
