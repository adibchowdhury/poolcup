const miniLeaderboard = [
  { rank: 1, name: "Jordan", points: 167, isGold: true },
  { rank: 2, name: "Sarah", points: 142 },
  { rank: 3, name: "Tyler", points: 128 },
  { rank: 4, name: "You", points: 112, isYou: true },
]

const tabs = [
  { id: "home", icon: "🏠", label: "Home", active: true },
  { id: "picks", icon: "⚽", label: "Picks", active: false },
  { id: "board", icon: "🏆", label: "Board", active: false },
  { id: "me", icon: "👤", label: "Me", active: false },
]

export default function MobileHomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-20">
      {/* Phone Frame */}
      <div className="relative">
        {/* Phone Shell */}
        <div className="w-[320px] bg-[#1a1a1a] rounded-[3rem] p-3 shadow-2xl shadow-black/50">
          {/* Notch */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20" />
          
          {/* Screen */}
          <div className="bg-[#080b0f] rounded-[2.25rem] overflow-hidden relative">
            {/* Status Bar */}
            <div className="h-12 flex items-end justify-center pb-1">
              <div className="flex items-center gap-1 text-[#f0f4f8] text-xs">
                <span className="font-mono">9:41</span>
              </div>
            </div>

            {/* Screen Content */}
            <div className="px-5 pb-20 pt-2">
              {/* Greeting */}
              <div className="mb-4">
                <div className="text-[#5a7080] text-xs uppercase tracking-widest">Good morning, Alex</div>
                <h1 className="font-display text-2xl text-[#f0f4f8] mt-1">MARKETING WC 26</h1>
              </div>

              {/* Next Match Card */}
              <div className="bg-gradient-to-br from-[#00e676]/20 to-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 mb-3">
                <div className="text-[#5a7080] text-xs mb-3">Next match</div>
                <div className="flex items-center justify-center gap-4 mb-3">
                  <span className="text-3xl">🇧🇷</span>
                  <div className="bg-[#1a2535] px-2 py-1 rounded text-[#5a7080] text-xs font-semibold">VS</div>
                  <span className="text-3xl">🇦🇷</span>
                </div>
                <div className="text-center">
                  <div className="font-mono text-2xl text-[#ffb300] tracking-wider">01:47:32</div>
                  <div className="text-[#5a7080] text-xs mt-1">until kickoff · predict now</div>
                </div>
              </div>

              {/* Rank Card */}
              <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-display text-4xl text-[#00e676]">4th</div>
                  <div className="text-[#f0f4f8] text-sm">Alex</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl text-[#f0f4f8]">112</div>
                  <div className="text-[#5a7080] text-xs">points</div>
                </div>
              </div>

              {/* Mini Leaderboard */}
              <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden">
                {miniLeaderboard.map((player, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.08)] last:border-b-0 ${
                      player.isYou ? "bg-[#00e676]/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs w-4 ${
                        player.isGold ? "text-[#FFD700]" : player.isYou ? "text-[#00e676]" : "text-[#5a7080]"
                      }`}>
                        #{player.rank}
                      </span>
                      <span className={`text-sm ${
                        player.isYou ? "text-[#00e676]" : "text-[#f0f4f8]"
                      }`}>
                        {player.name}
                      </span>
                    </div>
                    <span className="font-mono text-sm text-[#5a7080]">{player.points}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Tab Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-[#111a27] border-t border-[rgba(255,255,255,0.08)] px-6 py-2 pb-6">
              <div className="flex items-center justify-between">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex flex-col items-center gap-0.5 ${
                      tab.active ? "text-[#00e676]" : "text-[#5a7080]"
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="text-[10px]">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-8 text-center">
        <div className="font-display text-xl text-[#f0f4f8]">MOBILE-FIRST EXPERIENCE</div>
        <div className="text-[#5a7080] text-sm mt-1">Optimized for phones · No app download needed</div>
      </div>
    </div>
  )
}
