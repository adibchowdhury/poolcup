import { NextResponse } from 'next/server'
import {
  deriveMatchUpdateFromFixture,
  fetchFixtureById,
  fetchFixturesByIds,
  isFinalStatus,
  resolveFixtureScoresForForceClose,
  type ApiFootballFixture,
} from '@/src/lib/api-football'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { knockoutFinalizeFieldsFromFixture } from '@/src/lib/match-finalize'
import {
  canFinalizeMatchByKickoff,
  isValidApiFootballFixtureId,
  logUpdaterGuardWarning,
} from '@/src/lib/match-updater-guards'
import {
  isVoidMatchStatus,
  normalizeMatchStatusShort,
} from '@/src/lib/match-void-status'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { tryPostMatchMoments } from '@/src/lib/post-match-moments'
import { tryAwardPredictionXp } from '@/src/lib/xp'
import { tryRefreshMatchCrowdPicks } from '@/src/lib/match-crowd-picks'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STALE_CUTOFF_MINUTES = 135
/** Force-close when API feed is still "live" this long after kickoff. Group matches only. */
const FORCE_FINAL_MINUTES = 135
/** Only force-close when the feed still looks like late live play, not halftime or suspended. */
const FORCE_CLOSE_MIN_ELAPSED_MINUTE = 85
/** Hard catch-all: wall-clock threshold past which any stuck live status (incl. HT) may close. */
const FORCE_CLOSE_HARD_MINUTES = 155

/**
 * Re-verify recently-final matches for official score corrections.
 * Window field: `matches.kickoff_at` within the last FINAL_REVERIFY_LOOKBACK_DAYS.
 * (No separate finalized_at column — kickoff bounds recent finals.)
 */
const FINAL_REVERIFY_LOOKBACK_DAYS = 7
const DEFAULT_MAX_FINAL_REVERIFY = 40

const FORCE_CLOSE_ELIGIBLE_STATUSES = new Set([
  '2H',
  'ET',
  'BT',
  'P',
  'LIVE',
])

const FORCE_CLOSE_BLOCKED_STATUSES = new Set([
  '1H',
  'HT',
  'NS',
  'TBD',
  'SUSP',
  'INT',
  'PST',
  'ABD',
  'CANC',
  'AWD',
  'WO',
  'ET',
  'P',
])

/** Never hard force-close postponed/cancelled fixtures. */
const HARD_FORCE_CLOSE_BLOCKED_STATUSES = new Set([
  'NS',
  'TBD',
  'PST',
  'ABD',
  'CANC',
  'AWD',
  'WO',
])

const DEFAULT_MAX_CANDIDATES = 50

function getMaxCandidates(): number {
  const raw = process.env.RECONCILE_MAX_CANDIDATES
  if (!raw) return DEFAULT_MAX_CANDIDATES
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CANDIDATES
  return Math.min(parsed, 200)
}

function getMaxFinalReverify(): number {
  const raw = process.env.RECONCILE_MAX_FINAL_REVERIFY
  if (!raw) return DEFAULT_MAX_FINAL_REVERIFY
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_FINAL_REVERIFY
  return Math.min(parsed, 100)
}

type ReconcileError = {
  fixtureId: string
  message: string
}

type CandidateRow = {
  id: string
  fixture_id: string | null
  round: string
  team1_name: string
  team2_name: string
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  kickoff_at: string
  status_short: string | null
  elapsed_minute: number | null
  advancing_team?: number | null
}

type FinalReverifyRow = {
  id: string
  fixture_id: string | null
  round: string
  team1_name: string
  team2_name: string
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  kickoff_at: string
  status_short: string | null
  elapsed_minute: number | null
  advancing_team: number | null
}

type FinalReverifySummary = {
  checked: number
  corrected: number
  voided: number
  clawedBack: number
  unchanged: number
  errors: ReconcileError[]
}

type MatchLiveUpdatePayload = {
  status_short: string
  elapsed_minute?: number
  updated_at?: string
  result_team1?: number
  result_team2?: number
  advancing_team?: number
}

function canForceCloseStaleMatch(
  round: string,
  statusShort: string,
  elapsedMinute: number | null,
  minutesSinceKickoff: number,
): boolean {
  if (isKnockoutRound(round)) return false
  const status = statusShort.trim().toUpperCase()
  if (FORCE_CLOSE_BLOCKED_STATUSES.has(status)) return false
  if (!FORCE_CLOSE_ELIGIBLE_STATUSES.has(status)) return false
  if (elapsedMinute == null || elapsedMinute < FORCE_CLOSE_MIN_ELAPSED_MINUTE) {
    return false
  }
  return minutesSinceKickoff > FORCE_FINAL_MINUTES
}

function canHardForceCloseStaleMatch(
  round: string,
  statusShort: string,
  minutesSinceKickoff: number,
): boolean {
  if (isKnockoutRound(round)) return false
  const status = statusShort.trim().toUpperCase()
  if (HARD_FORCE_CLOSE_BLOCKED_STATUSES.has(status)) return false
  if (status === 'ET' || status === 'P') return false
  return minutesSinceKickoff > FORCE_CLOSE_HARD_MINUTES
}

async function finalizeForceClosedMatch(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  match: CandidateRow,
  label: string,
  fixtureId: string,
  resultTeam1: number,
  resultTeam2: number,
  ntfyMessage: string,
): Promise<'finalized' | 'update_error' | 'rpc_error'> {
  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      result_team1: resultTeam1,
      result_team2: resultTeam2,
      is_final: true,
      status_short: 'FT',
      updated_at: nowIso,
    })
    .eq('id', match.id)

  if (updateError) {
    return 'update_error'
  }

  const { error: rpcError } = await supabase.rpc('calculate_match_points', {
    p_match_id: match.id,
  })

  if (rpcError) {
    try {
      await sendOpsNtfy(
        `Error: auto-closed ${label} (fixture ${fixtureId}) in DB but calculate_match_points failed: ${rpcError.message}`,
      )
    } catch (notifyError) {
      console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
    }
    return 'rpc_error'
  }

  await tryPostMatchMoments(
    supabase,
    match.id,
    'reconcile-stale-matches:force-close',
  )
  await tryAwardPredictionXp(
    supabase,
    match.id,
    'reconcile-stale-matches:force-close',
  )

  try {
    await sendOpsNtfy(ntfyMessage)
  } catch (notifyError) {
    console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
  }

  return 'finalized'
}

async function sumPredictionPointsAwarded(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  matchId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('predictions')
    .select('points_awarded')
    .eq('match_id', matchId)

  if (error) {
    console.error('reconcile-stale-matches: failed to sum points_awarded', {
      matchId,
      message: error.message,
    })
    return null
  }

  return (data ?? []).reduce(
    (sum, row) => sum + (typeof row.points_awarded === 'number' ? row.points_awarded : 0),
    0,
  )
}

/**
 * Bounded re-check of recently-final matches for official score corrections.
 * Uses batched `fetchFixturesByIds` (≤20 ids/request) — same throttle pattern as sync-scores.
 *
 * Void rule: if API status is PST/CANC/ABD/AWD/WO, mark the match void
 * (`status_short` + `is_final=false`), then call `void_match_points` to reverse
 * any previously awarded points and rebuild leaderboards. Do NOT call
 * `calculate_match_points` on void.
 */
async function reverifyRecentFinalMatches(
  apiKey: string,
  supabase: ReturnType<typeof createAdminSupabaseClient>,
): Promise<FinalReverifySummary> {
  const nowMs = Date.now()
  const kickoffSinceIso = new Date(
    nowMs - FINAL_REVERIFY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const maxFinalReverify = getMaxFinalReverify()

  const summary: FinalReverifySummary = {
    checked: 0,
    corrected: 0,
    voided: 0,
    clawedBack: 0,
    unchanged: 0,
    errors: [],
  }

  const { data: rows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, round, team1_name, team2_name, result_team1, result_team2, is_final, kickoff_at, status_short, elapsed_minute, advancing_team',
    )
    .eq('is_final', true)
    .gte('kickoff_at', kickoffSinceIso)
    .lte('kickoff_at', new Date(nowMs).toISOString())
    .order('kickoff_at', { ascending: false })
    .limit(maxFinalReverify)

  if (loadError) {
    throw new Error(
      `Failed to load recent final matches for re-verify: ${loadError.message}`,
    )
  }

  const finals = (rows ?? []) as FinalReverifyRow[]
  const pollable = finals.filter((match) =>
    isValidApiFootballFixtureId(match.fixture_id),
  )

  for (const match of finals) {
    if (isValidApiFootballFixtureId(match.fixture_id)) continue
    logUpdaterGuardWarning(
      'reconcile-stale-matches:final-reverify',
      'Skipping final match with invalid fixture_id — will not poll API',
      {
        matchId: match.id,
        fixtureId: match.fixture_id,
        kickoffAt: match.kickoff_at,
      },
    )
    summary.unchanged += 1
  }

  summary.checked = finals.length

  if (pollable.length === 0) {
    return summary
  }

  const fixtureIds = pollable.map((m) => m.fixture_id as string)
  let fixtures: ApiFootballFixture[]
  try {
    fixtures = await fetchFixturesByIds(apiKey, fixtureIds)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'API-Football batch fetch failed'
    summary.errors.push({ fixtureId: 'batch', message })
    return summary
  }

  const fixtureById = new Map<string, ApiFootballFixture>()
  for (const fixture of fixtures) {
    fixtureById.set(String(fixture.fixture.id), fixture)
  }

  for (const match of pollable) {
    const fixtureId = match.fixture_id as string
    const label = `${match.team1_name} v ${match.team2_name}`

    try {
      const fixture = fixtureById.get(fixtureId)
      if (!fixture) {
        summary.errors.push({
          fixtureId,
          message: `API returned no fixture for final re-verify (match ${match.id})`,
        })
        continue
      }

      const apiStatus = normalizeMatchStatusShort(fixture.fixture.status.short)

      // Previously-final match became void after the fact — don't score; claw back points.
      if (isVoidMatchStatus(apiStatus)) {
        const alreadyVoidMarked =
          isVoidMatchStatus(match.status_short) && !match.is_final
        if (alreadyVoidMarked) {
          summary.unchanged += 1
          continue
        }

        const { error: voidUpdateError } = await supabase
          .from('matches')
          .update({
            status_short: apiStatus,
            is_final: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)

        if (voidUpdateError) {
          summary.errors.push({
            fixtureId,
            message: `void update failed: ${voidUpdateError.message}`,
          })
          continue
        }

        summary.voided += 1

        // Always call — idempotent when points are already 0.
        try {
          const { error: voidPointsError } = await supabase.rpc(
            'void_match_points',
            { p_match_id: match.id },
          )

          if (voidPointsError) {
            summary.errors.push({
              fixtureId,
              message: `void_match_points: ${voidPointsError.message}`,
            })
            console.error(
              'reconcile-stale-matches: void_match_points failed after void mark',
              {
                matchId: match.id,
                fixtureId,
                message: voidPointsError.message,
              },
            )
            try {
              await sendOpsNtfy(
                `Error: voided ${label} (match ${match.id}) ${apiStatus} but void_match_points failed: ${voidPointsError.message}`,
              )
            } catch (notifyError) {
              console.error(
                'reconcile-stale-matches: ops ntfy failed',
                notifyError,
              )
            }
          } else {
            summary.clawedBack += 1
            console.info(
              'reconcile-stale-matches: final match voided — points clawed back via void_match_points',
              {
                matchId: match.id,
                fixtureId,
                label,
                oldStatus: match.status_short,
                newStatus: apiStatus,
                oldScore: `${match.result_team1}-${match.result_team2}`,
              },
            )
            try {
              await sendOpsNtfy(
                `Final→void: ${label} (match ${match.id}) ${match.status_short ?? 'FT'} → ${apiStatus}. Points clawed back.`,
              )
            } catch (notifyError) {
              console.error(
                'reconcile-stale-matches: ops ntfy failed',
                notifyError,
              )
            }
          }
        } catch (voidPointsThrown) {
          const message =
            voidPointsThrown instanceof Error
              ? voidPointsThrown.message
              : 'void_match_points threw'
          summary.errors.push({ fixtureId, message })
          console.error(
            'reconcile-stale-matches: void_match_points threw after void mark',
            { matchId: match.id, fixtureId, message },
          )
        }
        continue
      }

      // Still final: compare official score/status (and knockout advance).
      if (!isFinalStatus(apiStatus)) {
        // Do not auto-unfinalize for live/other statuses — log only.
        console.warn(
          'reconcile-stale-matches: final match API status is no longer final (left unchanged)',
          {
            matchId: match.id,
            fixtureId,
            label,
            dbStatus: match.status_short,
            apiStatus,
          },
        )
        summary.unchanged += 1
        continue
      }

      const update = deriveMatchUpdateFromFixture(fixture)
      if (!update || !update.is_final) {
        summary.unchanged += 1
        continue
      }

      let advancingTeam: number | undefined
      if (isKnockoutRound(match.round)) {
        const knockoutFields = knockoutFinalizeFieldsFromFixture(
          match.round,
          fixture,
        )
        if (!knockoutFields) {
          summary.errors.push({
            fixtureId,
            message:
              'Knockout re-verify blocked: level score without advancing team',
          })
          continue
        }
        advancingTeam = knockoutFields.advancing_team
      }

      const scoreChanged =
        match.result_team1 !== update.result_team1 ||
        match.result_team2 !== update.result_team2
      const statusChanged =
        normalizeMatchStatusShort(match.status_short) !==
        normalizeMatchStatusShort(update.status_short)
      const advanceChanged =
        advancingTeam != null && advancingTeam !== match.advancing_team

      if (!scoreChanged && !statusChanged && !advanceChanged) {
        summary.unchanged += 1
        continue
      }

      const pointsBefore = await sumPredictionPointsAwarded(supabase, match.id)

      const correctionPayload: {
        result_team1: number
        result_team2: number
        is_final: true
        status_short: string
        elapsed_minute: number | null
        updated_at: string
        advancing_team?: number
      } = {
        result_team1: update.result_team1,
        result_team2: update.result_team2,
        is_final: true,
        status_short: update.status_short,
        elapsed_minute: update.elapsed_minute,
        updated_at: new Date().toISOString(),
      }
      if (advancingTeam != null) {
        correctionPayload.advancing_team = advancingTeam
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update(correctionPayload)
        .eq('id', match.id)

      if (updateError) {
        summary.errors.push({
          fixtureId,
          message: `correction update failed: ${updateError.message}`,
        })
        continue
      }

      // Delta-safe recalculation — do not modify calculate_match_points.
      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })

      if (rpcError) {
        summary.errors.push({
          fixtureId,
          message: `calculate_match_points after correction: ${rpcError.message}`,
        })
        try {
          await sendOpsNtfy(
            `Error: corrected ${label} (match ${match.id}) ${match.result_team1}-${match.result_team2}→${update.result_team1}-${update.result_team2} but calculate_match_points failed: ${rpcError.message}`,
          )
        } catch (notifyError) {
          console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
        }
        continue
      }

      // Idempotent — post_match_moments is keyed to avoid duplicate chat posts.
      await tryPostMatchMoments(
        supabase,
        match.id,
        'reconcile-stale-matches:final-reverify',
      )

      const pointsAfter = await sumPredictionPointsAwarded(supabase, match.id)
      const pointsDelta =
        pointsBefore != null && pointsAfter != null
          ? pointsAfter - pointsBefore
          : null

      summary.corrected += 1
      console.info('reconcile-stale-matches: final result corrected + points recalculated', {
        matchId: match.id,
        fixtureId,
        label,
        oldScore: `${match.result_team1}-${match.result_team2}`,
        newScore: `${update.result_team1}-${update.result_team2}`,
        oldStatus: match.status_short,
        newStatus: update.status_short,
        pointsBefore,
        pointsAfter,
        pointsDelta,
      })

      try {
        await sendOpsNtfy(
          `Final corrected: ${label} (match ${match.id}) ${match.result_team1}-${match.result_team2} → ${update.result_team1}-${update.result_team2}${
            pointsDelta != null ? ` (points Δ ${pointsDelta})` : ''
          }`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Final re-verify failed'
      summary.errors.push({ fixtureId, message })
      console.error('reconcile-stale-matches: final re-verify error', {
        matchId: match.id,
        fixtureId,
        message,
      })
    }
  }

  return summary
}

type ForceCloseKind = 'gentle' | 'hard'

async function attemptForceCloseWithResolvedScore(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  match: CandidateRow,
  label: string,
  fixtureId: string,
  fixture: ApiFootballFixture,
  update: { status_short: string; elapsed_minute: number | null },
  minutesSinceKickoff: number,
  kind: ForceCloseKind,
): Promise<'finalized' | 'no_score' | 'update_error' | 'rpc_error'> {
  const scores = resolveFixtureScoresForForceClose(
    fixture,
    match.result_team1,
    match.result_team2,
  )

  if (!scores) {
    const thresholdMinutes =
      kind === 'hard' ? FORCE_CLOSE_HARD_MINUTES : FORCE_FINAL_MINUTES
    try {
      await sendOpsNtfy(
        `Warning: stale match ${label} (fixture ${fixtureId}) past ${thresholdMinutes}m kickoff but no reliable score from API or DB — cannot ${kind} force-close.`,
      )
    } catch (notifyError) {
      console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
    }
    return 'no_score'
  }

  const ntfyMessage =
    kind === 'gentle'
      ? `Auto-closed ${label} (fixture ${fixtureId}) on score ${scores.resultTeam1}-${scores.resultTeam2} FT — feed still ${update.status_short} ${update.elapsed_minute ?? '?'}' ${Math.floor(minutesSinceKickoff)}m after kickoff. Sanity-check this result.`
      : `Hard auto-closed ${label} (fixture ${fixtureId}) on score ${scores.resultTeam1}-${scores.resultTeam2} FT — API still ${update.status_short} ${Math.floor(minutesSinceKickoff)}m after kickoff. Sanity-check this result.`

  return finalizeForceClosedMatch(
    supabase,
    match,
    label,
    fixtureId,
    scores.resultTeam1,
    scores.resultTeam2,
    ntfyMessage,
  )
}

async function runReconcile(): Promise<{
  candidates: number
  finalized: number
  stillLive: number
  alerted: number
  errors: ReconcileError[]
  finalReverify: FinalReverifySummary
}> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const supabase = createAdminSupabaseClient()
  const kickoffCutoff = new Date(
    Date.now() - STALE_CUTOFF_MINUTES * 60_000,
  ).toISOString()
  const maxCandidates = getMaxCandidates()

  const { data: candidateRows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, round, team1_name, team2_name, result_team1, result_team2, is_final, kickoff_at, status_short, elapsed_minute',
    )
    .eq('is_final', false)
    .lt('kickoff_at', kickoffCutoff)
    .order('kickoff_at', { ascending: true })
    .limit(maxCandidates)

  if (loadError) {
    throw new Error(`Failed to load stale matches: ${loadError.message}`)
  }

  const candidates = (candidateRows ?? []) as CandidateRow[]

  let finalized = 0
  let stillLive = 0
  let alerted = 0
  const errors: ReconcileError[] = []

  for (const match of candidates) {
    const label = `${match.team1_name} v ${match.team2_name}`

    if (!isValidApiFootballFixtureId(match.fixture_id)) {
      logUpdaterGuardWarning(
        'reconcile-stale-matches',
        'Skipping match with invalid or placeholder fixture_id — will not poll API',
        {
          matchId: match.id,
          fixtureId: match.fixture_id,
          kickoffAt: match.kickoff_at,
        },
      )
      stillLive += 1
      continue
    }

    const fixtureId = match.fixture_id as string

    let fixture
    try {
      fixture = await fetchFixtureById(apiKey, fixtureId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'API-Football fetch failed'
      errors.push({ fixtureId, message })
      continue
    }

    if (!fixture) {
      alerted += 1
      try {
        await sendOpsNtfy(
          `Warning: stale match ${label} (fixture ${fixtureId}): API returned no fixture`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    const update = deriveMatchUpdateFromFixture(fixture)
    if (!update) {
      alerted += 1
      const apiStatus = fixture.fixture.status.short
      try {
        await sendOpsNtfy(
          `Warning: stale match ${label} (fixture ${fixtureId}): API status "${apiStatus}" is not reconcilable`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    if (update.is_final) {
      if (!canFinalizeMatchByKickoff(match.kickoff_at)) {
        logUpdaterGuardWarning(
          'reconcile-stale-matches',
          'Refusing early finalize — API reported FT before minimum kickoff window elapsed',
          {
            matchId: match.id,
            fixtureId,
            kickoffAt: match.kickoff_at,
            apiStatus: update.status_short,
            minutesSinceKickoff: Math.floor(
              (Date.now() - new Date(match.kickoff_at).getTime()) / 60_000,
            ),
          },
        )
        stillLive += 1
        continue
      }

      const finalizePayload: {
        result_team1: number
        result_team2: number
        is_final: true
        status_short: string
        elapsed_minute: number | null
        advancing_team?: number
      } = {
        result_team1: update.result_team1,
        result_team2: update.result_team2,
        is_final: true,
        status_short: update.status_short,
        elapsed_minute: update.elapsed_minute,
      }

      if (isKnockoutRound(match.round)) {
        const knockoutFields = knockoutFinalizeFieldsFromFixture(
          match.round,
          fixture,
        )
        if (!knockoutFields) {
          stillLive += 1
          errors.push({
            fixtureId,
            message:
              'Knockout finalize blocked: level score without advancing team',
          })
          continue
        }
        finalizePayload.advancing_team = knockoutFields.advancing_team
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update(finalizePayload)
        .eq('id', match.id)

      if (updateError) {
        errors.push({ fixtureId, message: updateError.message })
        continue
      }

      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })

      if (rpcError) {
        errors.push({
          fixtureId,
          message: `calculate_match_points: ${rpcError.message}`,
        })
        try {
          await sendOpsNtfy(
            `Error: reconciled ${label} (fixture ${fixtureId}) in DB but calculate_match_points failed: ${rpcError.message}`,
          )
        } catch (notifyError) {
          console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
        }
        continue
      }

      await tryPostMatchMoments(
        supabase,
        match.id,
        'reconcile-stale-matches',
      )
      await tryAwardPredictionXp(
        supabase,
        match.id,
        'reconcile-stale-matches',
      )

      finalized += 1
      const score = `${update.result_team1}-${update.result_team2}`
      try {
        await sendOpsNtfy(
          `Reconciled ${label} -> ${score} ${update.status_short}`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    const minutesSinceKickoff =
      (Date.now() - new Date(match.kickoff_at).getTime()) / 60_000

    if (
      canForceCloseStaleMatch(
        match.round,
        update.status_short,
        update.elapsed_minute,
        minutesSinceKickoff,
      )
    ) {
      const closeResult = await attemptForceCloseWithResolvedScore(
        supabase,
        match,
        label,
        fixtureId,
        fixture,
        update,
        minutesSinceKickoff,
        'gentle',
      )

      if (closeResult === 'no_score') {
        alerted += 1
        stillLive += 1
        continue
      }
      if (closeResult === 'update_error') {
        errors.push({ fixtureId, message: 'Force-close update failed' })
        continue
      }
      if (closeResult === 'rpc_error') {
        errors.push({
          fixtureId,
          message: 'calculate_match_points failed after force-close',
        })
        continue
      }

      finalized += 1
      continue
    }

    if (
      canHardForceCloseStaleMatch(
        match.round,
        update.status_short,
        minutesSinceKickoff,
      )
    ) {
      const closeResult = await attemptForceCloseWithResolvedScore(
        supabase,
        match,
        label,
        fixtureId,
        fixture,
        update,
        minutesSinceKickoff,
        'hard',
      )

      if (closeResult === 'no_score') {
        alerted += 1
        stillLive += 1
        continue
      }
      if (closeResult === 'update_error') {
        errors.push({ fixtureId, message: 'Hard force-close update failed' })
        continue
      }
      if (closeResult === 'rpc_error') {
        errors.push({
          fixtureId,
          message: 'calculate_match_points failed after hard force-close',
        })
        continue
      }

      finalized += 1
      continue
    }

    stillLive += 1

    const apiElapsed = update.elapsed_minute
    const apiStatusShort = update.status_short

    const scoreOrFinalChanged =
      match.result_team1 !== update.result_team1 ||
      match.result_team2 !== update.result_team2

    const elapsedChanged =
      apiElapsed != null && apiElapsed !== match.elapsed_minute

    const statusChanged = apiStatusShort !== match.status_short

    if (!scoreOrFinalChanged && !elapsedChanged && !statusChanged) {
      alerted += 1
      try {
        await sendOpsNtfy(
          `Stale non-final match unchanged: ${label} (fixture ${fixtureId}) — API ${apiStatusShort} ${apiElapsed ?? '?'}' — ${Math.floor(minutesSinceKickoff)}m after kickoff. Reconcile could not advance; manual check may be needed.`,
        )
      } catch (notifyError) {
        console.error('reconcile-stale-matches: ops ntfy failed', notifyError)
      }
      continue
    }

    const updatePayload: MatchLiveUpdatePayload = {
      status_short: apiStatusShort,
    }

    if (apiElapsed != null) {
      updatePayload.elapsed_minute = apiElapsed
    }

    if (elapsedChanged) {
      updatePayload.updated_at = new Date().toISOString()
    }

    if (scoreOrFinalChanged) {
      updatePayload.result_team1 = update.result_team1
      updatePayload.result_team2 = update.result_team2
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id)

    if (updateError) {
      errors.push({ fixtureId, message: updateError.message })
    }
  }

  // After stale non-final reconcile: re-check recent finals for official corrections.
  // Best-effort — failures inside the pass are collected, not thrown.
  let finalReverify: FinalReverifySummary
  try {
    finalReverify = await reverifyRecentFinalMatches(apiKey, supabase)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Final re-verify pass failed'
    console.error('reconcile-stale-matches: final re-verify pass failed', error)
    finalReverify = {
      checked: 0,
      corrected: 0,
      voided: 0,
      clawedBack: 0,
      unchanged: 0,
      errors: [{ fixtureId: 'final-reverify', message }],
    }
  }

  if (finalized > 0 || finalReverify.corrected > 0) {
    await tryRefreshMatchCrowdPicks(supabase, 'reconcile-stale-matches')
  }

  return {
    candidates: candidates.length,
    finalized,
    stillLive,
    alerted,
    errors: [...errors, ...finalReverify.errors],
    finalReverify: {
      checked: finalReverify.checked,
      corrected: finalReverify.corrected,
      voided: finalReverify.voided,
      clawedBack: finalReverify.clawedBack,
      unchanged: finalReverify.unchanged,
      errors: finalReverify.errors,
    },
  }
}

async function handleReconcileRequest(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  try {
    const summary = await withSyncJob(
      supabase,
      { jobType: 'reconcile_stale_matches' },
      async () => {
        const result = await runReconcile()
        return {
          itemsProcessed: result.candidates,
          itemsChanged: result.finalized + (result.finalReverify?.corrected ?? 0),
          partial: result.errors.length > 0,
          detail: {
            stillLive: result.stillLive,
            alerted: result.alerted,
            finalReverify: result.finalReverify,
            errorCount: result.errors.length,
          },
          result,
        }
      },
    )
    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('reconcile-stale-matches error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleReconcileRequest(request)
}

export async function POST(request: Request) {
  return handleReconcileRequest(request)
}
