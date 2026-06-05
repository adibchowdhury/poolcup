import Image from 'next/image'
import { cn } from '@/lib/utils'

const SPORTS = [
  { label: 'Soccer', imageSrc: '/sports/soccer.png', available: true },
  { label: 'Basketball', imageSrc: '/sports/basketball.png', available: false },
  { label: 'Baseball', imageSrc: '/sports/baseball.png', available: false },
  { label: 'Football', imageSrc: '/sports/football.png', available: false },
  { label: 'Hockey', imageSrc: '/sports/hockey.png', available: false },
] as const

export function SportsSection() {
  return (
    <section className="bg-[#0d1520] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#5a7080]">
            Multi-sport pools
          </p>
          <h2 className="mb-4 font-display text-4xl text-[#f0f4f8] md:text-5xl">
            Pick your sport
          </h2>
          <p className="text-lg leading-relaxed text-[#5a7080]">
            When you create a pool, choose the sport your squad wants to follow.
            Soccer is live for World Cup 2026 — more sports are on the way.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 md:gap-5">
          {SPORTS.map((sport) => (
            <div
              key={sport.label}
              className={cn(
                'flex flex-col items-center gap-4 rounded-xl border px-4 py-8 text-center transition-colors',
                sport.available
                  ? 'border-[#00e676]/30 bg-[#00e676]/5'
                  : 'border-[rgba(255,255,255,0.08)] bg-[#111a27]/60 opacity-70',
              )}
            >
              <Image
                src={sport.imageSrc}
                alt={sport.label}
                width={160}
                height={160}
                className="h-40 w-40 object-contain"
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  sport.available ? 'text-[#00e676]' : 'text-[#f0f4f8]',
                )}
              >
                {sport.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
