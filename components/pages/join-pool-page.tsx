const members = [
  { name: "Jordan", role: "Creator", icon: "👑", predictions: null },
  { name: "Sarah", role: null, icon: null, predictions: 14 },
  { name: "Mike", role: null, icon: null, predictions: 9 },
  { name: "Alex", role: "you", icon: null, predictions: null, isJoining: true },
]

export default function JoinPoolPage() {
  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#111a27] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          {/* Pool Header Banner */}
          <div className="bg-gradient-to-br from-[#00e676]/20 to-[#111a27] p-6">
            <div className="inline-flex items-center gap-1.5 bg-[#080b0f]/50 px-2.5 py-1 rounded-full mb-3">
              <span className="text-sm">⚽</span>
              <span className="text-[#5a7080] text-xs">World Cup Pool</span>
            </div>
            <h1 className="font-display text-3xl text-[#f0f4f8] tracking-wide">MARKETING TEAM WC 2026</h1>
            <p className="text-[#5a7080] text-sm mt-2">Created by Jordan · Started Jun 11</p>
            <div className="mt-4 inline-flex items-center gap-2 bg-[#00e676]/10 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
              <span className="text-[#00e676] text-sm font-medium">14 members joined</span>
            </div>
          </div>

          {/* Join Form Section */}
          <div className="p-6">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                defaultValue="Alex"
                placeholder="Your name"
                className="flex-1 bg-[#1a2535] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-[#f0f4f8] placeholder-[#5a7080] focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676] transition-colors"
              />
              <button className="bg-[#00e676] text-[#080b0f] px-6 py-3 rounded-lg font-semibold hover:bg-[#00e676]/90 transition-all flex items-center gap-1.5">
                Join
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
            <p className="text-[#5a7080] text-xs text-center">No account needed · Free to join</p>

            {/* Member List */}
            <div className="mt-6 border-t border-[rgba(255,255,255,0.08)] pt-6">
              <div className="space-y-3">
                {members.map((member, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      member.isJoining
                        ? "bg-[#00e676]/10 border border-[#00e676]/30"
                        : "hover:bg-[#1a2535]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                        member.isJoining
                          ? "bg-[#00e676]/20 text-[#00e676]"
                          : "bg-[#1a2535] text-[#f0f4f8]"
                      }`}>
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${member.isJoining ? "text-[#00e676]" : "text-[#f0f4f8]"}`}>
                            {member.name}
                          </span>
                          {member.icon && <span className="text-sm">{member.icon}</span>}
                          {member.role === "you" && (
                            <span className="text-[#00e676] text-xs">(you)</span>
                          )}
                        </div>
                        {member.role === "Creator" && (
                          <span className="text-[#5a7080] text-xs">Creator</span>
                        )}
                        {member.predictions && (
                          <span className="text-[#5a7080] text-xs">{member.predictions} predictions</span>
                        )}
                      </div>
                    </div>
                    {member.isJoining && (
                      <span className="text-[#00e676] text-xs font-medium">Joining...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
