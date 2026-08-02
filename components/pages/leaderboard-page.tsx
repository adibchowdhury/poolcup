const podiumData = [
  { rank: 2, name: "Sarah", points: 142, color: "silver" },
  { rank: 1, name: "Jordan", points: 167, color: "gold" },
  { rank: 3, name: "Tyler", points: 128, color: "bronze" },
]

const leaderboardData = [
  { rank: 4, name: "Alex", points: 112, correct: "19/32", change: 2, isYou: true },
  { rank: 5, name: "Chris", points: 98, correct: "16/32", change: -1 },
  { rank: 6, name: "Priya", points: 91, correct: "15/32", change: 0 },
  { rank: 7, name: "Marcus", points: 87, correct: "14/32", change: 1 },
  { rank: 8, name: "Emma", points: 82, correct: "13/32", change: -2 },
]

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 bg-[#111a27] px-2.5 py-1 rounded-full mb-2">
            <span className="text-sm">🏆</span>
            <span className="text-[#5a7080] text-xs">Marketing Team</span>
          </div>
          <h1 className="font-display text-4xl text-[#f0f4f8]">LEADERBOARD</h1>
          
          {/* Stats Pills */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 rounded-full text-[#5a7080] text-xs">
              32 Matches played
            </span>
            <span className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 rounded-full text-[#5a7080] text-xs">
              14 Members
            </span>
            <span className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 rounded-full text-[#5a7080] text-xs">
              QF Stage
            </span>
          </div>
        </div>

        {/* Podium */}
        <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-4">
          <div className="flex items-end justify-center gap-3">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#1a2535] flex items-center justify-center font-semibold text-lg text-[#f0f4f8] mb-2">
                S
              </div>
              <div className="text-[#f0f4f8] font-medium text-sm">Sarah</div>
              <div className="font-display text-2xl text-[#f0f4f8]">142</div>
              <div className="w-16 h-20 bg-gradient-to-t from-[#C0C0C0]/20 to-[#C0C0C0]/5 rounded-t-lg mt-2 flex items-start justify-center pt-2">
                <span className="bg-[#C0C0C0] text-[#080b0f] text-xs font-bold px-2 py-0.5 rounded">2</span>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center -mt-4">
              <div className="w-20 h-20 rounded-full bg-[#1a2535] border-2 border-[#00e676] flex items-center justify-center font-semibold text-xl text-[#f0f4f8] mb-2">
                J
              </div>
              <div className="text-[#f0f4f8] font-medium">Jordan</div>
              <div className="font-display text-3xl text-[#00e676]">167</div>
              <div className="w-20 h-28 bg-gradient-to-t from-[#00e676]/20 to-[#00e676]/5 border-2 border-[#00e676] rounded-t-lg mt-2 flex items-start justify-center pt-2">
                <span className="bg-[#00e676] text-[#080b0f] text-xs font-bold px-2 py-0.5 rounded">1</span>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#1a2535] flex items-center justify-center font-semibold text-lg text-[#f0f4f8] mb-2">
                T
              </div>
              <div className="text-[#f0f4f8] font-medium text-sm">Tyler</div>
              <div className="font-display text-2xl text-[#f0f4f8]">128</div>
              <div className="w-16 h-16 bg-gradient-to-t from-[#5a7080]/20 to-[#5a7080]/5 rounded-t-lg mt-2 flex items-start justify-center pt-2">
                <span className="bg-[#5a7080] text-[#080b0f] text-xs font-bold px-2 py-0.5 rounded">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rankings List */}
        <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          {leaderboardData.map((player, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.08)] last:border-b-0 ${
                player.isYou ? "bg-[#00e676]/5 border-l-2 border-l-[#00e676]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[#5a7080] w-6">{player.rank}</span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  player.isYou ? "bg-[#00e676]/20 text-[#00e676]" : "bg-[#1a2535] text-[#f0f4f8]"
                }`}>
                  {player.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${player.isYou ? "text-[#00e676]" : "text-[#f0f4f8]"}`}>
                      {player.name}
                    </span>
                    {player.isYou && <span className="text-[#00e676] text-xs">(you)</span>}
                  </div>
                  <span className="text-[#5a7080] text-xs">{player.correct} correct</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-xs font-mono ${
                  player.change > 0 ? "text-[#00e676]" : player.change < 0 ? "text-[#ff4444]" : "text-[#5a7080]"
                }`}>
                  {player.change > 0 ? `↑${player.change}` : player.change < 0 ? `↓${Math.abs(player.change)}` : "—"}
                </div>
                <div className="font-display text-xl text-[#f0f4f8]">{player.points}<span className="text-[#5a7080] text-xs font-sans ml-0.5">pts</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
