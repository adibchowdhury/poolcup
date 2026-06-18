'use client'

import { Check, Lock, Star, Target, Trophy, Zap } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PLAYER_LEVEL_TIERS } from '@/src/lib/player-level'

const CLASSIC_GROUP_RULES = [
  'Exact score — 5 points',
  'Correct draw, wrong score — 3 points',
  'Correct winner, wrong score — 2 points',
  'Wrong outcome — 0 points',
] as const

const CLASSIC_KNOCKOUT_ROWS = [
  { round: 'Round of 32', exact: 7, winner: 3 },
  { round: 'Round of 16', exact: 10, winner: 4 },
  { round: 'Quarterfinals', exact: 12, winner: 5 },
  { round: 'Semifinals', exact: 15, winner: 6 },
  { round: 'Final', exact: 20, winner: 8 },
] as const

const WINNER_GROUP_RULES = [
  'Correct group winner — 5 points',
  'Both qualifiers (top two, any order) — 3 points',
  'Each team in its exact position — 2 points',
  'Each correct best third-place team — 2 points',
] as const

const WINNER_KNOCKOUT_ROWS = [
  { round: 'Round of 32', points: 3 },
  { round: 'Round of 16', points: 4 },
  { round: 'Quarterfinals', points: 5 },
  { round: 'Semifinals', points: 6 },
  { round: 'Final', points: 8 },
] as const

const SCORING_MODES = [
  {
    id: 'classic',
    label: 'Score Predictor',
    intro: 'Predict the exact final score of every match.',
    accent: 'border-[#3b82f6]/30 bg-[#3b82f6]/5',
    iconColor: 'text-[#3b82f6]',
    iconBg: 'bg-[#3b82f6]/15',
    icon: Target,
    groupHeading: 'Group stage',
    groupIntro:
      'Per match — highest tier that applies. Draws are possible in the group stage.',
    groupRules: CLASSIC_GROUP_RULES,
    knockoutHeading: 'Knockouts',
    knockoutIntro:
      'Per match — highest tier that applies. Knockout matches cannot end in a draw.',
    knockoutRows: CLASSIC_KNOCKOUT_ROWS,
    knockoutKind: 'classic' as const,
    footer:
      'Picks lock at kickoff. Points are added to your pool total and your cross-pool level.',
  },
  {
    id: 'winner',
    label: 'Winner Only',
    intro:
      "Predict each group's finishing order, plus the best third-place teams.",
    accent: 'border-[#22c55e]/30 bg-[#22c55e]/5',
    iconColor: 'text-[#22c55e]',
    iconBg: 'bg-[#22c55e]/15',
    icon: Zap,
    groupHeading: 'Group stage',
    groupIntro: 'Scored when each group finishes.',
    groupRules: WINNER_GROUP_RULES,
    knockoutHeading: 'Knockouts',
    knockoutIntro: 'Pick the winner of each knockout match.',
    knockoutRows: WINNER_KNOCKOUT_ROWS,
    knockoutKind: 'winner' as const,
    footer:
      "Up to 16 points per group. Picks lock at each group's first kickoff. Standings go by points (3 for a win, 1 for a draw), then goal difference, then goals scored.",
  },
] as const

function ScoringRulesList({
  rules,
  iconBg,
}: {
  rules: readonly string[]
  iconBg: string
}) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {rules.map((rule) => (
        <li key={rule} className="flex gap-2">
          <span
            className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', iconBg)}
          />
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  )
}

function ClassicKnockoutPointsTable({
  rows,
}: {
  rows: typeof CLASSIC_KNOCKOUT_ROWS
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Round</TableHead>
          <TableHead>Exact score</TableHead>
          <TableHead>Correct winner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.round}>
            <TableCell className="font-medium text-foreground">
              {row.round}
            </TableCell>
            <TableCell>{row.exact}</TableCell>
            <TableCell>{row.winner}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WinnerKnockoutPointsTable({
  rows,
}: {
  rows: typeof WINNER_KNOCKOUT_ROWS
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Round</TableHead>
          <TableHead>Correct winner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.round}>
            <TableCell className="font-medium text-foreground">
              {row.round}
            </TableCell>
            <TableCell>{row.points}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function formatPoints(value: number): string {
  return value.toLocaleString()
}

function getLevelProgress(
  index: number,
  currentPoints: number,
): { progressPercent: number; isUnlocked: boolean; isCurrent: boolean } {
  const level = PLAYER_LEVEL_TIERS[index]!
  const next = PLAYER_LEVEL_TIERS[index + 1]
  const isUnlocked = currentPoints >= level.minPoints

  if (!next) {
    return {
      progressPercent: isUnlocked ? 100 : 0,
      isUnlocked,
      isCurrent: isUnlocked,
    }
  }

  if (currentPoints >= next.minPoints) {
    return { progressPercent: 100, isUnlocked: true, isCurrent: false }
  }

  if (currentPoints < level.minPoints) {
    return { progressPercent: 0, isUnlocked: false, isCurrent: false }
  }

  const span = next.minPoints - level.minPoints
  const progressPercent =
    span > 0
      ? Math.min(100, ((currentPoints - level.minPoints) / span) * 100)
      : 100

  return { progressPercent, isUnlocked: true, isCurrent: true }
}

type HowItWorksTabProps = {
  currentPoints?: number
}

export function HowItWorksTab({ currentPoints = 0 }: HowItWorksTabProps) {
  const totalPoints = Math.max(0, currentPoints)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-12">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-[#ffb300]" />
          <div>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              How Scoring Works
            </h2>
            <p className="text-sm text-muted-foreground">
              Each pool uses one scoring style — pick what fits your group
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              You earn points from your predictions — they decide who wins each
              pool, and your running total across all pools sets your level.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SCORING_MODES.map((mode) => {
            const Icon = mode.icon
            return (
              <article
                key={mode.id}
                className={cn(
                  'flex h-full flex-col rounded-2xl border p-5 transition-colors',
                  mode.accent,
                )}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      mode.iconBg,
                    )}
                  >
                    <Icon className={cn('h-5 w-5', mode.iconColor)} />
                  </div>
                  <h3 className="font-display text-xl tracking-wide text-foreground">
                    {mode.label}
                  </h3>
                </div>

                <p className="mb-4 text-sm text-foreground">{mode.intro}</p>

                <div className="flex-1 space-y-5">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {mode.groupHeading}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mode.groupIntro}
                    </p>
                    <ScoringRulesList
                      rules={mode.groupRules}
                      iconBg={mode.iconBg}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {mode.knockoutHeading}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mode.knockoutIntro}
                    </p>
                    {mode.knockoutKind === 'classic' ? (
                      <ClassicKnockoutPointsTable rows={mode.knockoutRows} />
                    ) : (
                      <WinnerKnockoutPointsTable rows={mode.knockoutRows} />
                    )}
                  </div>
                </div>

                <p
                  className={cn(
                    'mt-4 border-t border-border/40 pt-4 text-xs leading-relaxed',
                    mode.iconColor,
                  )}
                >
                  {mode.footer}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              Levels &amp; Badges
            </h2>
            <p className="text-sm text-muted-foreground">
              Points come from your predictions in every pool (see scoring above).
              Your total across all pools is your level.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            All 10 levels
          </h3>
          <ul className="mt-3 divide-y divide-border/60">
            {PLAYER_LEVEL_TIERS.map((level, index) => {
              const { progressPercent, isUnlocked, isCurrent } = getLevelProgress(
                index,
                totalPoints,
              )

              return (
                <li
                  key={level.level}
                  className={cn(
                    'flex items-center gap-3 py-2.5 first:pt-0 last:pb-0',
                    isCurrent && 'rounded-lg bg-primary/5 px-2 -mx-2',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                      isUnlocked
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isUnlocked ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <p
                        className={cn(
                          'truncate',
                          isCurrent
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {level.level}.
                        </span>{' '}
                        {level.title}
                      </p>
                      <p className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatPoints(level.minPoints)} points
                      </p>
                    </div>

                    {isCurrent ? (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
