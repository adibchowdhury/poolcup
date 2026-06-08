'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

type FeatureTabKey = 'leaderboard' | 'predictions' | 'bragging' | 'winner'

type TabTheme = {
  accent: string
  tint: string
  border: string
}

const FEATURE_TABS: Array<{
  key: FeatureTabKey
  title: string
  headline: string
  icon: LucideIcon
  desc: string
  bullets: string[]
}> = [
  {
    key: 'leaderboard',
    title: 'Live Leaderboard',
    headline: 'Watch the standings change after every match.',
    icon: BarChart3,
    desc: 'Every correct prediction earns points and updates the leaderboard automatically. One great day can move you from last place to first.',
    bullets: [],
  },
  {
    key: 'predictions',
    title: 'Correct Predictions',
    headline: 'The closer your prediction, the more points you earn.',
    icon: Target,
    desc: 'Predict winners, nail exact scores, and rack up points throughout the tournament. Every match is another chance to climb the rankings.',
    bullets: [],
  },
  {
    key: 'bragging',
    title: 'Bragging Rights',
    headline: 'Settle who knows football best.',
    icon: Users,
    desc: 'No spreadsheets. No manual scoring. Just a live competition your whole group can follow from the opening match to the final.',
    bullets: [],
  },
  {
    key: 'winner',
    title: 'Winner Crowned',
    headline: 'One winner. Thirty-nine days of competition.',
    icon: Trophy,
    desc: 'As the tournament unfolds, every point matters. When the final whistle blows, one person finishes on top.',
    bullets: [],
  },
]

const FEATURE_TAB_THEME: Record<FeatureTabKey, TabTheme> = {
  leaderboard: {
    accent: '#00e676',
    tint: 'rgba(0, 230, 118, 0.12)',
    border: 'rgba(0, 230, 118, 0.28)',
  },
  predictions: {
    accent: '#3b82f6',
    tint: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.28)',
  },
  bragging: {
    accent: '#a78bfa',
    tint: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.28)',
  },
  winner: {
    accent: '#ffb300',
    tint: 'rgba(255, 179, 0, 0.12)',
    border: 'rgba(255, 179, 0, 0.28)',
  },
}

const previewShell =
  'relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#111a27] p-6 shadow-lg sm:p-7'

function FeaturePreview({ tab }: { tab: FeatureTabKey }) {
  const theme = FEATURE_TAB_THEME[tab]

  if (tab === 'leaderboard') {
    return (
      <div
        className={previewShell}
        style={{
          background: `linear-gradient(135deg, #111a27 0%, #111a27 55%, ${theme.tint} 100%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: theme.accent }}
          >
            Pool leaderboard
          </div>
          <div className="text-xs font-semibold text-[#5a7080]">Matchday 12</div>
        </div>
        <div className="mt-5 space-y-2">
          {[
            { rank: 1, name: 'Sarah', pts: '142', you: false },
            { rank: 2, name: 'Jordan', pts: '128', you: false },
            { rank: 3, name: 'Alex (you)', pts: '112', you: true },
          ].map((row) => (
            <div
              key={row.rank}
              className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 px-4 py-3"
              style={row.you ? { borderColor: theme.border, backgroundColor: theme.tint } : undefined}
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-display text-lg tabular-nums"
                  style={{ color: row.rank === 1 ? theme.accent : '#5a7080' }}
                >
                  {row.rank}
                </span>
                <span className="text-sm font-semibold text-[#f0f4f8]">{row.name}</span>
              </div>
              <span
                className="font-display text-sm font-bold tabular-nums"
                style={{ color: theme.accent }}
              >
                {row.pts} pts
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Rankings refresh automatically when match results are final.
        </div>
      </div>
    )
  }

  if (tab === 'predictions') {
    return (
      <div className={previewShell}>
        <div className="flex items-center justify-between">
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: theme.accent }}
          >
            Up next
          </div>
          <div className="text-xs font-semibold text-[#5a7080]">48 / 72 predicted</div>
        </div>
        <div className="mt-5 space-y-3">
          {[
            { a: '🇧🇷 Brazil', b: '🇦🇷 Argentina', s: '2 – 1' },
            { a: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', b: '🇫🇷 France', s: '—' },
          ].map((m) => (
            <div
              key={m.a}
              className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 p-4"
            >
              <div className="text-sm font-medium text-[#f0f4f8]">
                {m.a} <span className="text-[#5a7080]">vs</span> {m.b}
              </div>
              <div
                className="rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tabular-nums"
                style={
                  m.s !== '—'
                    ? { color: theme.accent, backgroundColor: theme.tint, border: `1px solid ${theme.border}` }
                    : { color: '#5a7080', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {m.s}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Lock in picks before kickoff — group stage and knockouts in one place.
        </div>
      </div>
    )
  }

  if (tab === 'bragging') {
    return (
      <div
        className={previewShell}
        style={{
          background: `linear-gradient(135deg, #111a27 0%, #111a27 55%, ${theme.tint} 100%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: theme.accent }}
          >
            Pool leaderboard
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: theme.tint,
              color: theme.accent,
              border: `1px solid ${theme.border}`,
            }}
          >
            1st place
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {[
            { rank: 1, name: 'Sarah', pts: '167', highlight: true },
            { rank: 2, name: 'Jordan', pts: '142', highlight: false },
            { rank: 3, name: 'Alex', pts: '128', highlight: false },
          ].map((row) => (
            <div
              key={row.rank}
              className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 px-4 py-3"
              style={
                row.highlight
                  ? { borderColor: theme.border, backgroundColor: theme.tint }
                  : undefined
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-display text-lg tabular-nums"
                  style={{ color: row.highlight ? theme.accent : '#5a7080' }}
                >
                  {row.rank}
                </span>
                <span className="text-sm font-semibold text-[#f0f4f8]">{row.name}</span>
              </div>
              <span
                className="font-display text-sm font-bold tabular-nums"
                style={{ color: row.highlight ? theme.accent : '#5a7080' }}
              >
                {row.pts} pts
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Everyone in your group sees the same live standings — no manual updates.
        </div>
      </div>
    )
  }

  // winner
  return (
    <div
      className={previewShell}
      style={{
        background: `linear-gradient(135deg, #111a27 0%, #111a27 55%, ${theme.tint} 100%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: theme.accent }} />
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: theme.accent }}
          >
            Final standings
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: theme.tint,
            color: theme.accent,
            border: `1px solid ${theme.border}`,
          }}
        >
          Champion
        </div>
      </div>
      <div className="mt-5">
        <div
          className="flex items-center justify-between rounded-2xl border px-4 py-4"
          style={{ borderColor: theme.border, backgroundColor: theme.tint }}
        >
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl tabular-nums" style={{ color: theme.accent }}>
              1
            </span>
            <div>
              <div className="text-sm font-semibold text-[#f0f4f8]">Sarah</div>
              <div className="text-xs text-[#5a7080]">Pool winner</div>
            </div>
          </div>
          <span className="font-display text-xl font-bold tabular-nums" style={{ color: theme.accent }}>
            312 pts
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {[
          { rank: 2, name: 'Jordan', pts: '287' },
          { rank: 3, name: 'Alex', pts: '264' },
        ].map((row) => (
          <div
            key={row.rank}
            className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-display text-lg tabular-nums text-[#5a7080]">{row.rank}</span>
              <span className="text-sm font-semibold text-[#f0f4f8]">{row.name}</span>
            </div>
            <span className="font-display text-sm font-bold tabular-nums text-[#5a7080]">
              {row.pts} pts
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
        Thirty-nine days of picks — one name on top when the final ends.
      </div>
    </div>
  )
}

export function FeatureTabsSection() {
  const [active, setActive] = useState<FeatureTabKey>('leaderboard')
  const t = FEATURE_TABS.find((x) => x.key === active) ?? FEATURE_TABS[0]
  const theme = FEATURE_TAB_THEME[t.key]
  const activeIndex = Math.max(
    0,
    FEATURE_TABS.findIndex((x) => x.key === active),
  )
  const reverse = activeIndex % 2 === 1

  return (
    <section
      id="features"
      className="bg-[#0d1520] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="font-display text-3xl tracking-wide text-[#f0f4f8] whitespace-nowrap sm:text-4xl lg:text-5xl">
            Turn Every World Cup Match Into a Competition
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#5a7080]">
            Every prediction counts. Follow the standings, chase perfect picks, and see who comes out on top when the tournament ends.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-5xl justify-center">
          <div className="flex max-w-full gap-3 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FEATURE_TABS.map((tab) => {
              const selected = tab.key === active
              const tabTheme = FEATURE_TAB_THEME[tab.key]
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition sm:px-6 sm:py-3.5 sm:text-base ${
                    selected
                      ? 'text-[#f0f4f8]'
                      : 'border-[rgba(255,255,255,0.08)] bg-[#111a27] text-[#5a7080] hover:border-[rgba(255,255,255,0.15)] hover:text-[#f0f4f8]'
                  }`}
                  style={
                    selected
                      ? {
                          backgroundColor: tabTheme.tint,
                          borderColor: tabTheme.border,
                          color: tabTheme.accent,
                        }
                      : undefined
                  }
                  aria-pressed={selected}
                >
                  <TabIcon
                    className="h-5 w-5"
                    style={selected ? { color: tabTheme.accent } : { color: '#5a7080' }}
                  />
                  <span className="whitespace-nowrap">{tab.title}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          <div
            key={t.key}
            className={`flex flex-col justify-center transition-opacity duration-300 ${reverse ? 'lg:order-2' : 'lg:order-1'}`}
          >
            <h3 className="font-display text-2xl tracking-wide text-[#f0f4f8] sm:text-3xl">
              {t.headline}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#5a7080] sm:text-base">{t.desc}</p>

            {t.bullets.length > 0 && (
              <ul className="mt-6 space-y-3">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-[#5a7080]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-7">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[#080b0f] shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: theme.accent }}
              >
                Create a pool
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div
            key={`${t.key}-preview`}
            className={`transition-opacity duration-300 ${reverse ? 'lg:order-1' : 'lg:order-2'}`}
          >
            <FeaturePreview tab={t.key} />
          </div>
        </div>
      </div>
    </section>
  )
}
