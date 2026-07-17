'use client'

import type { ReactNode } from 'react'
import {
  DashboardGlassBackdrops,
  dashboardGlassSurfaceClass,
} from '@/components/dashboard/dashboard-glass-surface'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'

/** Outer alignment slot — same layout box as real flags (7.3125rem square). */
export const SCOREBOARD_TEAM_GRAPHIC_SLOT_CLASS =
  'flex h-[7.3125rem] w-[7.3125rem] shrink-0 items-center justify-center'

/** Landscape flag visual — 3:2 at slot width (matches object-contain flag footprint). */
export const SCOREBOARD_FLAG_VISUAL_CLASS =
  'aspect-[3/2] w-[7.3125rem] shrink-0'

/** Fixed outer slot — matches horizontal scroller tile width + height. */
export const SCOREBOARD_CARD_SLOT_CLASS =
  'h-[15.75rem] w-[85vw] max-w-[22rem] shrink-0 snap-start [&>*]:h-full'

export const SCOREBOARD_CARD_SHELL_CLASS = cn(
  dashboardGlassSurfaceClass('3xl'),
  'relative flex h-full w-full flex-col overflow-hidden rounded-3xl px-2 py-1',
)

export function ScoreboardCardShell({ children }: { children: ReactNode }) {
  return (
    <article className={SCOREBOARD_CARD_SHELL_CLASS}>
      <DashboardGlassBackdrops variant="full" />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </article>
  )
}

export function ScoreboardCompetitionLabel({ label }: { label: string }) {
  return (
    <p className="mb-0 shrink-0 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  )
}

export function ScoreboardHeaderRow({
  leftPill,
  topRight,
}: {
  leftPill: ReactNode
  topRight: ReactNode
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 items-center gap-0.5">
      <div className="justify-self-start">{leftPill}</div>
      <div className="justify-self-end text-right">{topRight}</div>
    </div>
  )
}

export function ScoreboardRoundPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
    </span>
  )
}

export function ScoreboardKickoffTopRight({ kickoffAt }: { kickoffAt: string }) {
  return (
    <time
      dateTime={kickoffAt}
      className="block max-w-[9.5rem] text-right text-[10px] font-medium leading-snug text-muted-foreground"
      suppressHydrationWarning
    >
      {formatFeaturedKickoffLocal(kickoffAt)}
    </time>
  )
}

export function ScoreboardStatusTopRight({ label }: { label: string }) {
  return (
    <span className="block max-w-[9.5rem] text-right text-[10px] font-medium uppercase leading-snug tracking-wider text-muted-foreground">
      {label}
    </span>
  )
}

export function ScoreboardLiveTopRight({ clockLabel }: { clockLabel: string | null }) {
  return (
    <div className="flex max-w-[9.5rem] flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
        <span
          className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
          aria-hidden
        />
        Live
      </span>
      {clockLabel ? (
        <span
          className="text-[10px] font-medium tabular-nums tracking-wide text-primary"
          suppressHydrationWarning
        >
          {clockLabel}
        </span>
      ) : null}
    </div>
  )
}

export function ScoreboardFlagTeam({
  name,
  dbFlag,
}: {
  name: string
  dbFlag: string | null
}) {
  return (
    <div className="mx-auto flex w-max min-w-0 max-w-full flex-col items-center justify-center gap-0">
      <div className={SCOREBOARD_TEAM_GRAPHIC_SLOT_CLASS}>
        <TeamFlagImage
          countryName={name}
          dbFlag={dbFlag}
          imgClassName={cn(SCOREBOARD_FLAG_VISUAL_CLASS, 'object-contain')}
          emojiClassName="text-6xl leading-none"
        />
      </div>
      <span className="-mt-0.5 line-clamp-2 max-w-full text-center text-lg font-bold leading-tight text-foreground">
        {name}
      </span>
    </div>
  )
}

export function ScoreboardMonogramTeam({
  code,
  name,
}: {
  code: string
  name: string
}) {
  return (
    <div className="mx-auto flex w-max min-w-0 max-w-full flex-col items-center justify-center gap-0">
      <div className={SCOREBOARD_TEAM_GRAPHIC_SLOT_CLASS}>
        <div
          className={cn(
            SCOREBOARD_FLAG_VISUAL_CLASS,
            'flex items-center justify-center overflow-hidden',
            'rounded-sm border border-white/10 bg-white/[0.06]',
          )}
          aria-hidden
        >
          <span className="font-display text-lg tracking-wider text-foreground">
            {code}
          </span>
        </div>
      </div>
      <span className="-mt-0.5 line-clamp-2 max-w-full text-center text-lg font-bold leading-tight text-foreground">
        {name}
      </span>
    </div>
  )
}

export function ScoreboardMatchupGrid({
  team1,
  center,
  team2,
  centerIsScore = false,
}: {
  team1: ReactNode
  center: ReactNode
  team2: ReactNode
  /** Wider center column when showing a score (live/final). */
  centerIsScore?: boolean
}) {
  return (
    <div className="-mt-0.5 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-items-center gap-0">
      {team1}
      <div
        className={cn(
          'flex shrink-0 flex-col items-center justify-center self-center',
          centerIsScore ? 'min-w-[4.5rem] px-0.5' : 'px-1',
        )}
      >
        {center}
      </div>
      {team2}
    </div>
  )
}

export function ScoreboardVsCenter() {
  return (
    <span className="font-display text-2xl uppercase tracking-[0.2em] text-muted-foreground">
      vs
    </span>
  )
}

export function ScoreboardScoreCenter({
  score1,
  score2,
}: {
  score1: number
  score2: number
}) {
  return (
    <p className="whitespace-nowrap font-display text-4xl leading-none tracking-wider text-foreground tabular-nums">
      <span className="text-primary">{score1}</span>
      <span className="mx-1 text-muted-foreground/80">–</span>
      <span className="text-primary">{score2}</span>
    </p>
  )
}
