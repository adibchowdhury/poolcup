'use client'

import { useEffect, useState } from 'react'
import { Star, Target, Trophy, Zap } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import { MAX_XP_LEVEL, xpForLevel, xpToLevel } from '@/src/lib/levels'
import { supabase } from '@/src/lib/supabase'
import { fetchUserXpTotal, XP_ACTION_AMOUNTS } from '@/src/lib/xp'

const CLASSIC_GROUP_RULES = [
  'Exact score — 5 points',
  'Correct draw, wrong score — 3 points',
  'Correct winner, wrong score — 2 points',
  'Wrong outcome — 0 points',
] as const

const CLASSIC_KNOCKOUT_ROWS = [
  { round: 'Round of 32', exact: 7, advance: 3 },
  { round: 'Round of 16', exact: 10, advance: 4 },
  { round: 'Quarterfinals', exact: 12, advance: 5 },
  { round: 'Semifinals', exact: 15, advance: 6 },
  { round: '3rd Place Playoff', exact: 15, advance: 6 },
  { round: 'Final', exact: 20, advance: 8 },
] as const

const CLASSIC_KNOCKOUT_INTRO_LINES = [
  'You predict the final score, including extra time. Penalties never change the score.',
  'The two columns stack: you earn the exact-score points if you nail the score, plus the advance bonus if you correctly call which team goes through.',
  'Knockout matches can\'t end in a draw, so if a match is level and goes to penalties, your separate "who advances" pick decides the bonus.',
  'Nail both and you score the full amount, e.g. 10 points in the Round of 32.',
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
  { round: '3rd Place Playoff', points: 6 },
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
    knockoutIntroLines: CLASSIC_KNOCKOUT_INTRO_LINES,
    knockoutRows: CLASSIC_KNOCKOUT_ROWS,
    knockoutKind: 'classic' as const,
    footer:
      'Picks lock at kickoff. Points stay in that pool’s leaderboard. XP (a separate currency) is awarded when the match is scored.',
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
          <TableHead>Who advances</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.round}>
            <TableCell className="font-medium text-foreground">
              {row.round}
            </TableCell>
            <TableCell>{row.exact}</TableCell>
            <TableCell>{row.advance}</TableCell>
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

const XP_MILESTONES = [1, 2, 5, 10, 25, 50] as const

const XP_ACTION_ROWS = [
  { source: 'prediction_made', label: 'Made a prediction', amount: XP_ACTION_AMOUNTS.prediction_made },
  { source: 'prediction_correct', label: 'Correct winner', amount: XP_ACTION_AMOUNTS.prediction_correct },
  { source: 'prediction_exact', label: 'Exact score', amount: XP_ACTION_AMOUNTS.prediction_exact },
  { source: 'prediction_draw', label: 'Soccer draw', amount: XP_ACTION_AMOUNTS.prediction_draw },
  { source: 'pool_join', label: 'Join a pool', amount: XP_ACTION_AMOUNTS.pool_join },
  { source: 'pool_create', label: 'Create a pool', amount: XP_ACTION_AMOUNTS.pool_create },
  { source: 'invite_accepted', label: 'Someone joins via your invite', amount: XP_ACTION_AMOUNTS.invite_accepted },
  { source: 'friend_added', label: 'Add a friend (both of you)', amount: XP_ACTION_AMOUNTS.friend_added },
  { source: 'pool_chat_first', label: 'First message in a pool', amount: XP_ACTION_AMOUNTS.pool_chat_first },
  { source: 'daily_active', label: 'Daily visit', amount: XP_ACTION_AMOUNTS.daily_active },
  { source: 'onboarding_complete', label: 'Finish onboarding', amount: XP_ACTION_AMOUNTS.onboarding_complete },
] as const

type HowItWorksTabProps = {
  currentXp?: number
}

export function HowItWorksTab({ currentXp = 0 }: HowItWorksTabProps) {
  const { user } = useAuth()
  const [ledgerXp, setLedgerXp] = useState(Math.max(0, currentXp))

  useEffect(() => {
    if (!user?.id) return
    void fetchUserXpTotal(supabase, user.id).then(setLedgerXp)
  }, [user?.id])

  const level = xpToLevel(ledgerXp)

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
              You earn pool points from your predictions — they decide who
              wins each pool. Your PoolCup level is a separate XP total from
              actions and badges.
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
                    <div className="space-y-2">
                      {'knockoutIntroLines' in mode ? (
                        <div className="space-y-2">
                          {mode.knockoutIntroLines.map((line) => (
                            <p
                              key={line}
                              className="text-xs leading-relaxed text-muted-foreground"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {mode.knockoutIntro}
                        </p>
                      )}
                    </div>
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

        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            How ties are broken
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            When two players finish with the same total points, the leaderboard
            uses a fixed order so places stay consistent.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Score Predictor
              </h4>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>Most exact scores (correct scoreline)</li>
                <li>Most correct winners</li>
                <li>A stable tiebreaker for a consistent ranking</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Winner Only
              </h4>
              <p className="text-sm text-muted-foreground">
                Tied players stay in a stable, consistent order (no exact-score
                count in these pools).
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              XP, Levels &amp; Badges
            </h2>
            <p className="text-sm text-muted-foreground">
              XP is recorded on an idempotent ledger (one grant per action).
              Pool points still decide who wins a pool — they do not set your
              level. You earn XP from play (predictions, joining/creating
              pools, friends, chat, daily activity, onboarding) and from
              unlocking badges. There are {MAX_XP_LEVEL} levels.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your level
              </p>
              <p className="mt-0.5 font-display text-4xl tabular-nums text-foreground">
                {level.level}
              </p>
            </div>
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {ledgerXp.toLocaleString()} XP
              {level.nextLevelThreshold != null
                ? ` · ${level.xpToNext.toLocaleString()} to next`
                : ' · Max'}
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`XP progress for Level ${level.level}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={level.progressPct}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${level.progressPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            How you earn XP
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Each action grants once (same source can&apos;t pay twice). Badge
            unlocks add that badge&apos;s XP on top.
          </p>
          <Table className="mt-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Action</TableHead>
                <TableHead className="text-right">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {XP_ACTION_ROWS.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="text-foreground">{row.label}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    +{row.amount}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="text-foreground">Unlock a badge</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                    +badge XP
                  </TableCell>
                </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            Level milestones
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The curve is quadratic: L2 = 100 XP, L5 = 1,000, L10 = 4,500,
            L50 = 122,500.
          </p>
          <ul className="mt-3 divide-y divide-border/60">
            {XP_MILESTONES.map((milestone) => {
              const floor = xpForLevel(milestone)
              const reached = ledgerXp >= floor
              return (
                <li
                  key={milestone}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      'text-sm',
                      reached ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Level {milestone}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {floor.toLocaleString()} XP
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
