'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, Target, Users } from 'lucide-react'
import { PredictScoreInput } from '@/components/predict/predict-match-row-shared'
import { MatchTeamRosters } from '@/components/match/match-team-rosters'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GlobalMatchPhase } from '@/src/lib/global-match-phase'
import {
  formatPoolScoringLabel,
  USE_MOCK_HUB,
  type FriendMatchPrediction,
  type HeadToHeadData,
  type MatchCommonScore,
  type MatchConsensus,
  type MatchRelatedPool,
  type PoolMatchDistribution,
  type TeamFormEntry,
} from '@/src/lib/match-hub-data'
import { isMatchLocked } from '@/src/lib/match-lock'
import type { MyMatchPredictions } from '@/src/lib/my-match-predictions'
import {
  clampPredictionScoreValue,
  parsePredictionScores,
  upsertPoolMatchPrediction,
} from '@/src/lib/pool-match-prediction-write'
import type { TeamRosterPlayer } from '@/src/lib/team-roster'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { supabase } from '@/src/lib/supabase'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'
import { matchStartLabelLower } from '@/src/lib/match-status-display'

export type WritableScorePool = {
  poolId: string
  memberId: string
  inviteCode: string
}

type MatchHubPanelsProps = {
  matchId: string
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo: string | null
  team2Logo: string | null
  lockedAt: string | null
  phase: GlobalMatchPhase
  sport?: string | null
  isLoggedIn: boolean
  consensus: MatchConsensus | null
  commonScores: MatchCommonScore[]
  friends: FriendMatchPrediction[]
  myPredictions: MyMatchPredictions | null
  myPickPoints: number | null
  writablePools: WritableScorePool[]
  competitionPools: MatchRelatedPool[]
  poolDistributions: PoolMatchDistribution[]
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
  headToHead: HeadToHeadData | null
  team1Players: TeamRosterPlayer[]
  team2Players: TeamRosterPlayer[]
  rostersLoading: boolean
  onPredictionSaved?: () => void
}

function SectionShell({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-[#1a1a1a]/55 p-4 sm:p-5',
        className,
      )}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function ConsensusBars({
  consensus,
  team1Name,
  team2Name,
}: {
  consensus: MatchConsensus
  team1Name: string
  team2Name: string
}) {
  const rows = [
    { key: 'home', label: team1Name, pct: consensus.homePct, bar: 'bg-primary' },
    { key: 'draw', label: 'Draw', pct: consensus.drawPct, bar: 'bg-muted-foreground/70' },
    { key: 'away', label: team2Name, pct: consensus.awayPct, bar: 'bg-sky-400' },
  ] as const

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-foreground">{row.label}</span>
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
              {Math.round(row.pct)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn('h-full rounded-full transition-all', row.bar)}
              style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {consensus.total.toLocaleString()} prediction
        {consensus.total === 1 ? '' : 's'} across PoolCup
      </p>
    </div>
  )
}

function FormDots({ entries }: { entries: TeamFormEntry[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Recent form">
      {entries.map((entry, index) => {
        const color =
          entry.result === 'W'
            ? 'bg-emerald-500'
            : entry.result === 'D'
              ? 'bg-amber-400'
              : 'bg-rose-500'
        const titleBits = [
          entry.result,
          entry.opponent ? `vs ${entry.opponent}` : null,
          entry.scoreLabel,
        ].filter(Boolean)
        return (
          <span
            key={`${entry.result}-${index}`}
            title={titleBits.join(' · ')}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-black',
              color,
            )}
          >
            {entry.result}
          </span>
        )
      })}
    </div>
  )
}

function JoinPoolToPredictPrompt({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <SectionShell title="Predict this match">
      <p className="text-sm text-muted-foreground">
        Join a pool to predict this match. Score picks live inside your pools.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isLoggedIn ? (
          <Button asChild>
            <Link href="/dashboard">Browse pools</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Browse pools</Link>
            </Button>
          </>
        )}
      </div>
    </SectionShell>
  )
}

/** Only rendered when the user already has a real prediction for this match. */
function YourPredictionCard({
  matchId,
  team1Name,
  team2Name,
  lockedAt,
  phase,
  sport,
  myPredictions,
  myPickPoints,
  writablePools,
  onPredictionSaved,
}: {
  matchId: string
  team1Name: string
  team2Name: string
  lockedAt: string | null
  phase: GlobalMatchPhase
  sport?: string | null
  myPredictions: MyMatchPredictions
  myPickPoints: number | null
  writablePools: WritableScorePool[]
  onPredictionSaved?: () => void
}) {
  const locked =
    USE_MOCK_HUB
      ? false
      : isMatchLocked(lockedAt) || phase !== 'upcoming'
  const primaryPick = myPredictions.picks[0]!
  const showPickPoints =
    (phase === 'final' || phase === 'live') && myPickPoints != null

  const [editing, setEditing] = useState(false)
  const [score1, setScore1] = useState(String(primaryPick.team1))
  const [score2, setScore2] = useState(String(primaryPick.team2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setScore1(String(primaryPick.team1))
    setScore2(String(primaryPick.team2))
    setEditing(false)
  }, [primaryPick.team1, primaryPick.team2])

  const parsed = useMemo(
    () => parsePredictionScores(score1, score2),
    [score1, score2],
  )

  async function handleSave() {
    if (!parsed || locked) return

    // TEMPORARY — mock hub never writes predictions to the DB.
    if (USE_MOCK_HUB) {
      setEditing(false)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1800)
      return
    }

    if (writablePools.length === 0) return
    setSaving(true)
    setError(null)

    const results = await Promise.all(
      writablePools.map((pool) =>
        upsertPoolMatchPrediction(supabase, {
          poolId: pool.poolId,
          memberId: pool.memberId,
          matchId,
          predTeam1: parsed.predTeam1,
          predTeam2: parsed.predTeam2,
        }),
      ),
    )

    const failed = results.find((result) => !result.ok)
    setSaving(false)

    if (failed && !failed.ok) {
      setError(
        failed.isLockViolation
          ? 'Predictions are locked for this match.'
          : failed.error || 'Could not save prediction.',
      )
      return
    }

    capturePostHog('prediction_edited_from_match', {
      match_id: matchId,
      pool_count: writablePools.length,
    })
    void import('@/components/push/push-nudge-host').then(
      ({ markFirstPredictionForPushNudge }) => {
        markFirstPredictionForPushNudge()
      },
    )

    setEditing(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
    onPredictionSaved?.()
  }

  if (!editing) {
    return (
      <SectionShell title="Your prediction">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl tracking-wide text-foreground">
              {primaryPick.team1}–{primaryPick.team2}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Submitted
                {myPredictions.pool_count > 1
                  ? ` · ${myPredictions.pool_count} pools`
                  : null}
              </span>
              {showPickPoints ? (
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {myPickPoints! > 0 ? `+${myPickPoints}` : '0'} pts on this pick
                </span>
              ) : null}
            </p>
            {savedFlash ? (
              <p className="mt-1 text-xs text-primary">Saved</p>
            ) : null}
          </div>
          {!locked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit until {matchStartLabelLower(sport)}
            </Button>
          ) : null}
        </div>
      </SectionShell>
    )
  }

  return (
    <SectionShell title="Your prediction">
      <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <span className="max-w-[7rem] truncate text-center text-xs text-muted-foreground">
            {team1Name}
          </span>
          <PredictScoreInput
            value={score1}
            onChange={(value) => setScore1(clampPredictionScoreValue(value))}
            label={`${team1Name} score`}
            filled={score1 !== ''}
            disabled={locked || saving}
          />
        </div>
        <span className="pb-3 font-display text-lg text-muted-foreground">–</span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="max-w-[7rem] truncate text-center text-xs text-muted-foreground">
            {team2Name}
          </span>
          <PredictScoreInput
            value={score2}
            onChange={(value) => setScore2(clampPredictionScoreValue(value))}
            label={`${team2Name} score`}
            filled={score2 !== ''}
            disabled={locked || saving}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          disabled={!parsed || saving || (!USE_MOCK_HUB && writablePools.length === 0)}
          onClick={() => void handleSave()}
        >
          <Target className="h-4 w-4" aria-hidden />
          {saving ? 'Saving…' : 'Update prediction'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            setScore1(String(primaryPick.team1))
            setScore2(String(primaryPick.team2))
            setEditing(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      ) : null}
    </SectionShell>
  )
}

function CompetitionPanel({
  pools,
  phase,
  sport,
}: {
  pools: MatchRelatedPool[]
  phase: GlobalMatchPhase
  sport?: string | null
}) {
  if (pools.length === 0) return null

  // TEMPORARY — mock preview always shows ranks so the design is visible.
  const afterKickoff = USE_MOCK_HUB || phase !== 'upcoming'
  const startLower = matchStartLabelLower(sport)
  const yours = pools.filter((pool) => pool.isYours)
  const others = pools.filter((pool) => !pool.isYours)

  return (
    <div className="space-y-4">
      {yours.length > 0 ? (
        <SectionShell title="Your pools for this match">
          <ul className="space-y-2">
            {yours.map((pool) => (
              <li key={pool.id}>
                <Link
                  href={USE_MOCK_HUB ? '#' : `/pool/${pool.inviteCode}`}
                  onClick={USE_MOCK_HUB ? (e) => e.preventDefault() : undefined}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors',
                    'border-primary/35 bg-primary/10 hover:bg-primary/15',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {pool.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPoolScoringLabel(pool.scoringStyle)}
                      {pool.members > 0
                        ? ` · ${pool.members} member${pool.members === 1 ? '' : 's'}`
                        : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {afterKickoff ? (
                      pool.yourRank != null ? (
                        <>
                          <p className="font-mono text-sm font-semibold text-foreground">
                            #{pool.yourRank}
                          </p>
                          {pool.yourPoints != null ? (
                            <p className="text-[11px] text-muted-foreground">
                              {pool.yourPoints} pts
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Rank pending
                        </p>
                      )
                    ) : (
                      <p className="max-w-[7.5rem] text-[11px] leading-snug text-muted-foreground">
                        Positions update after {startLower}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionShell>
      ) : null}

      {others.length > 0 ? (
        <SectionShell title="Pools covering this match">
          <ul className="space-y-2">
            {others.map((pool) => (
              <li key={pool.id}>
                <Link
                  href={USE_MOCK_HUB ? '#' : `/pool/${pool.inviteCode}`}
                  onClick={USE_MOCK_HUB ? (e) => e.preventDefault() : undefined}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {pool.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPoolScoringLabel(pool.scoringStyle)}
                      {pool.members > 0
                        ? ` · ${pool.members} member${pool.members === 1 ? '' : 's'}`
                        : null}
                    </p>
                  </div>
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionShell>
      ) : null}
    </div>
  )
}

function TeamFormSection({
  team1Name,
  team2Name,
  team1Form,
  team2Form,
}: {
  team1Name: string
  team2Name: string
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
}) {
  if (team1Form.length === 0 && team2Form.length === 0) return null

  return (
    <SectionShell title="Team form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{team1Name}</p>
          {team1Form.length > 0 ? (
            <FormDots entries={team1Form} />
          ) : (
            <p className="text-xs text-muted-foreground">No recent results</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{team2Name}</p>
          {team2Form.length > 0 ? (
            <FormDots entries={team2Form} />
          ) : (
            <p className="text-xs text-muted-foreground">No recent results</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Last 5 results · W win · D draw · L loss
      </p>
    </SectionShell>
  )
}

function HeadToHeadSection({
  team1Name,
  team2Name,
  headToHead,
}: {
  team1Name: string
  team2Name: string
  headToHead: HeadToHeadData | null
}) {
  const meetings = headToHead?.meetings ?? []
  const previous = meetings[0] ?? null
  const hasH2h =
    headToHead != null &&
    (meetings.length > 0 ||
      headToHead.team1Wins > 0 ||
      headToHead.draws > 0 ||
      headToHead.team2Wins > 0)

  if (!hasH2h || !headToHead) return null

  return (
    <SectionShell title="Head-to-head">
      <p className="font-display text-lg tracking-wide text-foreground">
        {team1Name} {headToHead.team1Wins}W · {headToHead.draws}D ·{' '}
        {headToHead.team2Wins}L {team2Name}
      </p>

      {previous &&
      previous.resultTeam1 != null &&
      previous.resultTeam2 != null ? (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Previous meeting
          </p>
          <p className="mt-1 text-sm text-foreground">
            {previous.team1Name} {previous.resultTeam1}–{previous.resultTeam2}{' '}
            {previous.team2Name}
          </p>
          {previous.kickoffAt ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatFeaturedKickoffLocal(previous.kickoffAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {meetings.length > 1 ? (
        <ul className="mt-3 space-y-2">
          {meetings.slice(0, 5).map((meeting, index) => (
            <li
              key={`${meeting.kickoffAt ?? 'm'}-${index}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {meeting.team1Name} vs {meeting.team2Name}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-foreground">
                {meeting.resultTeam1 != null && meeting.resultTeam2 != null
                  ? `${meeting.resultTeam1}–${meeting.resultTeam2}`
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionShell>
  )
}

function FriendsPredictionsSection({
  friends,
  postLock,
  isLoggedIn,
  sport,
}: {
  friends: FriendMatchPrediction[]
  postLock: boolean
  isLoggedIn: boolean
  sport?: string | null
}) {
  if (!isLoggedIn) return null

  if (!postLock) {
    return (
      <SectionShell title="Friends' predictions">
        <p className="text-sm text-muted-foreground">
          Friends&apos; picks are revealed after {matchStartLabelLower(sport)}.
        </p>
      </SectionShell>
    )
  }

  if (friends.length === 0) return null

  return (
    <SectionShell title="Friends' predictions">
      <ul className="space-y-2">
        {friends.map((friend) => (
          <li
            key={friend.userId}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
          >
            <UserAvatarImage
              avatar={friend.avatar}
              customAvatarUrl={friend.customAvatarUrl}
              alt={friend.displayName}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {friend.displayName}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
              {friend.predTeam1 != null && friend.predTeam2 != null
                ? `${friend.predTeam1}–${friend.predTeam2}`
                : '—'}
            </span>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

function PoolDistributionsSection({
  distributions,
  team1Name,
  team2Name,
  postLock,
}: {
  distributions: PoolMatchDistribution[]
  team1Name: string
  team2Name: string
  postLock: boolean
}) {
  if (!postLock) return null
  if (distributions.length === 0) return null

  return (
    <div className="space-y-4">
      {distributions.map((dist) => (
        <SectionShell
          key={dist.poolId}
          title={`Pool picks · ${dist.poolName}`}
        >
          <p className="mb-3 text-xs text-muted-foreground">
            {dist.total} prediction{dist.total === 1 ? '' : 's'} in this pool
          </p>
          <div className="space-y-2">
            {(
              [
                { label: team1Name, pct: dist.homePct, bar: 'bg-primary' },
                {
                  label: 'Draw',
                  pct: dist.drawPct,
                  bar: 'bg-muted-foreground/70',
                },
                { label: team2Name, pct: dist.awayPct, bar: 'bg-sky-400' },
              ] as const
            ).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {row.label}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {row.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn('h-full rounded-full', row.bar)}
                    style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {dist.topScores.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
              {dist.topScores.map((row) => (
                <li
                  key={row.score}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {row.score}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {row.pct}% ({row.count})
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href={`/pool/${dist.inviteCode}`}
            className={cn(
              'mt-3 inline-flex text-xs font-medium text-primary hover:underline',
              FOCUS_VISIBLE_RING,
            )}
          >
            Open pool
          </Link>
        </SectionShell>
      ))}
    </div>
  )
}

export function MatchHubPanels({
  matchId,
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
  team1Logo,
  team2Logo,
  lockedAt,
  phase,
  sport,
  isLoggedIn,
  consensus,
  commonScores,
  friends,
  myPredictions,
  myPickPoints,
  writablePools,
  competitionPools,
  poolDistributions,
  team1Form,
  team2Form,
  headToHead,
  team1Players,
  team2Players,
  rostersLoading,
  onPredictionSaved,
}: MatchHubPanelsProps) {
  const hasPrediction = Boolean(
    myPredictions?.has_prediction && myPredictions.picks[0],
  )
  const showSquads =
    rostersLoading || team1Players.length > 0 || team2Players.length > 0
  const postLock = USE_MOCK_HUB || isMatchLocked(lockedAt)
  const startLower = matchStartLabelLower(sport)

  return (
    <div className="space-y-4 sm:space-y-5">
      {USE_MOCK_HUB ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
          TEMPORARY mock hub preview — set{' '}
          <code className="font-mono">USE_MOCK_HUB</code> to{' '}
          <code className="font-mono">false</code> in{' '}
          <code className="font-mono">match-hub-data.ts</code> to restore real data.
        </p>
      ) : null}

      {hasPrediction && myPredictions ? (
        <YourPredictionCard
          matchId={matchId}
          team1Name={team1Name}
          team2Name={team2Name}
          lockedAt={lockedAt}
          phase={phase}
          sport={sport}
          myPredictions={myPredictions}
          myPickPoints={myPickPoints}
          writablePools={writablePools}
          onPredictionSaved={onPredictionSaved}
        />
      ) : (
        <JoinPoolToPredictPrompt isLoggedIn={isLoggedIn || USE_MOCK_HUB} />
      )}

      <TeamFormSection
        team1Name={team1Name}
        team2Name={team2Name}
        team1Form={team1Form}
        team2Form={team2Form}
      />

      {postLock ? (
        consensus && consensus.total > 0 ? (
          <SectionShell title="PoolCup consensus">
            <ConsensusBars
              consensus={consensus}
              team1Name={team1Name}
              team2Name={team2Name}
            />
          </SectionShell>
        ) : null
      ) : (
        <SectionShell title="PoolCup consensus">
          <p className="text-sm text-muted-foreground">
            Community prediction split is revealed after {startLower}.
          </p>
        </SectionShell>
      )}

      {postLock ? (
        commonScores.length > 0 ? (
          <SectionShell title="Most predicted scorelines">
            <ul className="space-y-2">
              {commonScores.map((row) => (
                <li
                  key={row.score}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                >
                  <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                    {row.score}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(row.pct)}%
                    <span className="ml-2 text-[11px]">
                      ({row.count.toLocaleString()})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionShell>
        ) : null
      ) : (
        <SectionShell title="Most predicted scorelines">
          <p className="text-sm text-muted-foreground">
            Popular scorelines are revealed after {startLower}.
          </p>
        </SectionShell>
      )}

      <FriendsPredictionsSection
        friends={friends}
        postLock={postLock}
        isLoggedIn={isLoggedIn || USE_MOCK_HUB}
        sport={sport}
      />

      <PoolDistributionsSection
        distributions={poolDistributions}
        team1Name={team1Name}
        team2Name={team2Name}
        postLock={postLock}
      />

      <CompetitionPanel pools={competitionPools} phase={phase} sport={sport} />

      <HeadToHeadSection
        team1Name={team1Name}
        team2Name={team2Name}
        headToHead={headToHead}
      />

      {showSquads ? (
        <MatchTeamRosters
          team1Name={team1Name}
          team2Name={team2Name}
          team1Flag={team1Flag}
          team2Flag={team2Flag}
          team1Logo={team1Logo}
          team2Logo={team2Logo}
          team1Players={team1Players}
          team2Players={team2Players}
          loading={rostersLoading}
        />
      ) : null}
    </div>
  )
}
