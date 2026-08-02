"use client"

import { useState } from "react"

type MatchCard = {
  id: number
  team1: string
  flag1: string
  team2: string
  flag2: string
  score1: string
  score2: string
  completed: boolean
  locked?: boolean
}

const matchesData: Record<string, MatchCard[]> = {
  "Thursday Jun 12": [
    { id: 1, team1: "Mexico", flag1: "🇲🇽", team2: "S.Africa", flag2: "🇿🇦", score1: "2", score2: "1", completed: true },
    { id: 2, team1: "Korea", flag1: "🇰🇷", team2: "Czech Rep", flag2: "🇨🇿", score1: "1", score2: "1", completed: true },
  ],
  "Friday Jun 13": [
    { id: 3, team1: "Brazil", flag1: "🇧🇷", team2: "Argentina", flag2: "🇦🇷", score1: "", score2: "", completed: false },
    { id: 4, team1: "England", flag1: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", team2: "France", flag2: "🇫🇷", score1: "", score2: "", completed: false },
    { id: 5, team1: "Germany", flag1: "🇩🇪", team2: "Japan", flag2: "🇯🇵", score1: "", score2: "", completed: false, locked: true },
  ],
}

export default function PredictMatchesPage() {
  const [predictions, setPredictions] = useState<Record<number, { score1: string; score2: string }>>({
    1: { score1: "2", score2: "1" },
    2: { score1: "1", score2: "1" },
  })

  const updatePrediction = (matchId: number, field: "score1" | "score2", value: string) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value,
      },
    }))
  }

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-[#f0f4f8]">YOUR PREDICTIONS</h1>
          <div className="inline-flex items-center gap-2 bg-[#ffb300]/10 px-3 py-1.5 rounded-full">
            <span className="text-[#ffb300]">⏱</span>
            <span className="text-[#ffb300] text-sm font-medium">6 matches lock in 2h</span>
          </div>
        </div>

        {/* Match Days */}
        <div className="space-y-6">
          {Object.entries(matchesData).map(([day, matches]) => (
            <div key={day}>
              <h2 className="text-[#5a7080] text-xs uppercase tracking-wider mb-3">{day}</h2>
              <div className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 ${
                      match.locked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Team 1 */}
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-2xl">{match.flag1}</span>
                        <span className="text-[#f0f4f8] font-medium text-sm">{match.team1}</span>
                      </div>

                      {/* Score Inputs */}
                      {match.locked ? (
                        <div className="px-4 py-2 bg-[#1a2535] rounded-lg">
                          <span className="text-[#5a7080] text-xs font-semibold tracking-wider">LOCKED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            placeholder="–"
                            value={predictions[match.id]?.score1 || match.score1}
                            onChange={(e) => updatePrediction(match.id, "score1", e.target.value)}
                            className={`w-12 h-11 rounded-md text-center font-display text-xl focus:outline-none focus:ring-2 focus:ring-[#00e676] transition-all placeholder:text-[#5a7080] placeholder:font-sans placeholder:text-base ${
                              match.completed
                                ? "bg-[#00e676]/15 border-2 border-[#00e676] text-[#00e676]"
                                : "bg-[#0d1318] border border-[rgba(255,255,255,0.15)] text-[#f0f4f8] hover:border-[rgba(255,255,255,0.25)]"
                            }`}
                          />
                          <span className="text-[#5a7080] text-lg">:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            placeholder="–"
                            value={predictions[match.id]?.score2 || match.score2}
                            onChange={(e) => updatePrediction(match.id, "score2", e.target.value)}
                            className={`w-12 h-11 rounded-md text-center font-display text-xl focus:outline-none focus:ring-2 focus:ring-[#00e676] transition-all placeholder:text-[#5a7080] placeholder:font-sans placeholder:text-base ${
                              match.completed
                                ? "bg-[#00e676]/15 border-2 border-[#00e676] text-[#00e676]"
                                : "bg-[#0d1318] border border-[rgba(255,255,255,0.15)] text-[#f0f4f8] hover:border-[rgba(255,255,255,0.25)]"
                            }`}
                          />
                          {match.completed && (
                            <div className="w-6 h-6 rounded-full bg-[#00e676] flex items-center justify-center ml-1">
                              <svg className="w-3.5 h-3.5 text-[#080b0f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Team 2 */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-[#f0f4f8] font-medium text-sm">{match.team2}</span>
                        <span className="text-2xl">{match.flag2}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111a27] border-t border-[rgba(255,255,255,0.08)] p-4">
        <div className="max-w-lg mx-auto">
          <button className="w-full bg-[#00e676] text-[#080b0f] py-4 rounded-lg font-semibold text-base hover:bg-[#00e676]/90 transition-all flex items-center justify-center gap-2">
            Save predictions
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
