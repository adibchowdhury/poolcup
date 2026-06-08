'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  Link2,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

type FeatureTabKey =
  | 'leaderboard'
  | 'predictions'
  | 'scoring'
  | 'invites'
  | 'live'
  | 'pools'

type TabTheme = {
  accent: string
  tint: string
  border: string
}

const FEATURE_TABS: Array<{
  key: FeatureTabKey
  title: string
  icon: LucideIcon
  desc: string
  bullets: string[]
}> = [
  {
    key: 'leaderboard',
    title: 'Leaderboard',
    icon: BarChart3,
    desc: 'See who’s on top with live rankings, points, and correct-prediction counts for your whole squad.',
    bullets: [
      'Rankings update automatically after final scores',
      'Points, correct picks, and movement at a glance',
      'Private to your pool — only members can view',
    ],
  },
  {
    key: 'predictions',
    title: 'Predictions',
    icon: Target,
    desc: 'Pick scores before kickoff for every group-stage and knockout match in one clean flow.',
    bullets: [
      'Group stage and knockouts in dedicated tabs',
      'See what’s up next and what you still owe',
      'Save progress in bulk before deadlines',
    ],
  },
  {
    key: 'scoring',
    title: 'Scoring',
    icon: Trophy,
    desc: 'Choose how your pool awards points — simple winner picks or full score predictions.',
    bullets: [
      'Winner Only or Score Predictor styles',
      'Set once when you create the pool',
      'Fair, automatic points — no manual spreadsheets',
    ],
  },
  {
    key: 'invites',
    title: 'Invites',
    icon: Users,
    desc: 'Share one link. Coworkers, friends, or your group chat join in seconds.',
    bullets: [
      'One private invite link per pool',
      'Members join free — creator pays once',
      'Works on any phone or browser',
    ],
  },
  {
    key: 'live',
    title: 'Live',
    icon: Zap,
    desc: 'When matches finish, scores flow in and leaderboards refresh without anyone lifting a finger.',
    bullets: [
      'Results synced from official match data',
      'Points calculated instantly',
      'No admin work during the tournament',
    ],
  },
  {
    key: 'pools',
    title: 'Pools',
    icon: Link2,
    desc: 'Create and manage private World Cup pools without wrestling with spreadsheets or group chats.',
    bullets: [
      'Name your pool and pick scoring in under a minute',
      'Free to create — unlimited members',
      'Full tournament coverage in one place',
    ],
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
  scoring: {
    accent: '#ffb300',
    tint: 'rgba(255, 179, 0, 0.12)',
    border: 'rgba(255, 179, 0, 0.28)',
  },
  invites: {
    accent: '#a78bfa',
    tint: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.28)',
  },
  live: {
    accent: '#f472b6',
    tint: 'rgba(244, 114, 182, 0.12)',
    border: 'rgba(244, 114, 182, 0.28)',
  },
  pools: {
    accent: '#38bdf8',
    tint: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.28)',
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

  if (tab === 'scoring') {
    return (
      <div
        className={previewShell}
        style={{
          background: `linear-gradient(135deg, #111a27 0%, #111a27 55%, ${theme.tint} 100%)`,
        }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: theme.accent }}
        >
          Scoring style
        </div>
        <div className="mt-5 grid gap-2">
          {[
            { label: 'Score Predictor', pts: '5 / 2 / 0', on: true },
            { label: 'Winner Only', pts: '2 / 0', on: false },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-2xl border px-4 py-3"
              style={
                s.on
                  ? { borderColor: theme.border, backgroundColor: theme.tint }
                  : { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(8, 11, 15, 0.8)' }
              }
            >
              <span className="text-sm font-semibold text-[#f0f4f8]">{s.label}</span>
              <span className="text-xs font-medium text-[#5a7080]">{s.pts} pts</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Pick your rules once — PoolCup handles the math all tournament long.
        </div>
      </div>
    )
  }

  if (tab === 'invites') {
    return (
      <div className={previewShell}>
        <div className="flex items-center justify-between">
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: theme.accent }}
          >
            Invite link
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: theme.tint,
              color: theme.accent,
              border: `1px solid ${theme.border}`,
            }}
          >
            12 members
          </div>
        </div>
        <div
          className="mt-5 rounded-2xl border p-4 font-mono text-xs text-[#f0f4f8] break-all"
          style={{ borderColor: theme.border, backgroundColor: theme.tint }}
        >
          getpoolcup.com/join/marketing-wc-2026
        </div>
        <div className="mt-4 flex gap-2">
          {['Jordan', 'Sarah', 'Mike', '+9'].map((name) => (
            <div
              key={name}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#080b0f] text-xs font-semibold text-[#f0f4f8]"
            >
              {name.startsWith('+') ? name : name[0]}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Copy one link to Slack, email, or the group chat — done.
        </div>
      </div>
    )
  }

  if (tab === 'live') {
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
            Just finished
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00e676]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#00e676]" />
            Live update
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 p-5">
          <div className="text-sm font-semibold text-[#f0f4f8]">🇲🇽 Mexico 2 – 1 🇿🇦 South Africa</div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold text-[#5a7080]">Your pick</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#f0f4f8]">2 – 1</div>
            </div>
            <div
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ backgroundColor: theme.tint, color: theme.accent, border: `1px solid ${theme.border}` }}
            >
              +3 pts
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/50 p-4 text-sm text-[#5a7080]">
          Final whistles trigger scoring — leaderboard updates on its own.
        </div>
      </div>
    )
  }

  // pools
  return (
    <div className={previewShell}>
      <div className="flex items-center justify-between">
        <div
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: theme.accent }}
        >
          Your pools
        </div>
        <div className="text-xs font-semibold text-[#5a7080]">Dashboard</div>
      </div>
      <div className="mt-5 grid gap-3">
        {[
          { n: 'Marketing Team WC 2026', m: '12 members', role: 'Creator' },
          { n: 'Sunday League Picks', m: '8 members', role: 'Member' },
        ].map((x) => (
          <div
            key={x.n}
            className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#080b0f]/80 p-4"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#f0f4f8]">{x.n}</div>
              <div className="text-xs text-[#5a7080]">{x.m}</div>
            </div>
            <div
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: theme.tint, color: theme.accent, border: `1px solid ${theme.border}` }}
            >
              {x.role}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.15)] py-3 text-sm font-medium text-[#5a7080]">
        + Create another pool
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
  const Icon = t.icon

  return (
    <section
      id="features"
      className="bg-[#0d1520] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl tracking-wide text-[#f0f4f8] sm:text-5xl">
            Everything you need
          </h2>
          <p className="mt-3 text-[#5a7080]">
            Explore what makes PoolCup the easiest way to run a private World Cup prediction pool.
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

        <div className="mx-auto mt-10 grid max-w-5xl items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          <div
            key={t.key}
            className={`transition-opacity duration-300 ${reverse ? 'lg:order-2' : 'lg:order-1'}`}
          >
            <div
              className="inline-flex items-center gap-2 rounded-full border bg-[#111a27] px-3 py-1 text-xs font-semibold"
              style={{ borderColor: theme.border, color: theme.accent }}
            >
              <Icon className="h-4 w-4" style={{ color: theme.accent }} />
              {t.title}
            </div>
            <h3 className="mt-4 font-display text-2xl tracking-wide text-[#f0f4f8] sm:text-3xl">
              {t.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#5a7080] sm:text-base">{t.desc}</p>

            <ul className="mt-6 space-y-3">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-[#5a7080]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

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
