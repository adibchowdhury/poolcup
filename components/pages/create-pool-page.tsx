"use client"

import { useState } from "react"

const scoringStyles = [
  { id: "winner", label: "Winner Only" },
  { id: "classic", label: "Score Predictor" },
]

export default function CreatePoolPage() {
  const [selectedStyle, setSelectedStyle] = useState("winner")

  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#00e676]/10 flex items-center justify-center">
                <span className="text-xl">🏆</span>
              </div>
              <div>
                <h1 className="font-display text-2xl text-[#f0f4f8]">CREATE YOUR POOL</h1>
                <p className="text-[#5a7080] text-sm">Takes 60 seconds</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 pb-6 space-y-5">
            {/* Pool Name */}
            <div>
              <label className="block text-[#5a7080] text-xs uppercase tracking-wider mb-2">Pool Name</label>
              <input
                type="text"
                defaultValue="Marketing Team WC 2026"
                className="w-full bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[#f0f4f8] placeholder-[#5a7080] focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676] transition-colors"
              />
            </div>

            {/* Scoring Style */}
            <div>
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

            {/* Tournament Stage */}
            <div>
              <label className="block text-[#5a7080] text-xs uppercase tracking-wider mb-2">Tournament Stage</label>
              <div className="relative">
                <select className="w-full bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[#f0f4f8] appearance-none focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676] transition-colors cursor-pointer">
                  <option>Full tournament — all 104 matches</option>
                  <option>Group stage only — 48 matches</option>
                  <option>Knockout stage only — 56 matches</option>
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a7080] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* CTA Button */}
            <button className="w-full bg-[#00e676] text-[#080b0f] py-4 rounded-lg font-semibold text-base hover:bg-[#00e676]/90 transition-all hover:scale-[1.01] flex items-center justify-center gap-2">
              Create Pool
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
