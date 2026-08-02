const goalscorers = [
  { time: "23'", player: "Rodrygo", flag: "🇧🇷" },
  { time: "57'", player: "Álvarez", flag: "🇦🇷" },
  { time: "78'", player: "Endrick", flag: "🇧🇷" },
]

const reactions = [
  { emoji: "🔥", text: "Jordan got it too!" },
  { emoji: "😤", text: "Mike missed" },
]

export default function MatchResultPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        {/* Match Result Card */}
        <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          {/* Match Header */}
          <div className="bg-gradient-to-br from-[#1a2535] to-[#111a27] p-6 text-center">
            <div className="text-[#00e676] text-xs uppercase tracking-widest font-semibold mb-4">
              Group Stage · Group B · Match 18
            </div>
            
            {/* Teams and Score */}
            <div className="flex items-center justify-center gap-6">
              {/* Brazil */}
              <div className="flex flex-col items-center">
                <span className="text-5xl mb-2">🇧🇷</span>
                <span className="text-[#f0f4f8] font-medium">Brazil</span>
              </div>

              {/* Score */}
              <div className="font-display text-6xl text-[#f0f4f8] tracking-wider">
                2 <span className="text-[#5a7080]">—</span> 1
              </div>

              {/* Argentina */}
              <div className="flex flex-col items-center">
                <span className="text-5xl mb-2">🇦🇷</span>
                <span className="text-[#f0f4f8] font-medium">Argentina</span>
              </div>
            </div>
          </div>

          {/* Your Prediction */}
          <div className="bg-[#00e676]/10 border-t border-b border-[#00e676]/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-1">Your Prediction</div>
                <div className="text-[#f0f4f8] font-medium">Brazil 2 — 1 Argentina</div>
                <div className="text-[#00e676] text-xs mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Exact score!
                </div>
              </div>
              <div className="font-display text-4xl text-[#00e676]">+5</div>
            </div>
          </div>

          {/* Goalscorers */}
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
            <div className="space-y-2">
              {goalscorers.map((goal, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${goal.flag === "🇧🇷" ? "bg-[#00e676]" : "bg-[#5a7080]"}`} />
                  <span className="font-mono text-[#5a7080] text-sm w-8">{goal.time}</span>
                  <span className="text-[#f0f4f8] text-sm">{goal.player}</span>
                  <span className="text-base">{goal.flag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pool Reactions */}
          <div className="p-4">
            <div className="text-[#5a7080] text-xs uppercase tracking-wider mb-3">Pool reactions</div>
            <div className="flex gap-2 flex-wrap">
              {reactions.map((reaction, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 bg-[#1a2535] px-3 py-1.5 rounded-full"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-[#f0f4f8] text-sm">{reaction.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
