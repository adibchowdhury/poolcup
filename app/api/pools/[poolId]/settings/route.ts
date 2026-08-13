import { NextResponse } from 'next/server'
import {
  fetchIsPoolAdmin,
  logPoolModeration,
} from '@/src/lib/pool-admin'
import {
  normalizePoolDescription,
  normalizePoolName,
  validatePoolDescription,
  validatePoolName,
} from '@/src/lib/pool-name'
import {
  CLASSIC_DEFAULT_DRAW_POINTS,
  CLASSIC_DEFAULT_EXACT_POINTS,
  CLASSIC_DEFAULT_WINNER_POINTS,
  resolveClassicScorePoints,
  scorePointsForDb,
  validateClassicScoringPoints,
} from '@/src/lib/classic-score-points'
import {
  isValidPoolThemeHex,
  normalizePoolThemeColor,
} from '@/src/lib/pool-theme'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

type PatchBody = {
  name?: string
  description?: string | null
  acceptingMembers?: boolean
  themeColor?: string | null
  scoreExactPoints?: number | null
  scoreWinnerPoints?: number | null
  scoreDrawPoints?: number | null
  /** Required when competition has started and scoring values change. */
  confirmRecalculate?: boolean
}

/**
 * Admin (owner or co-commissioner) pool settings updates + moderation logging.
 */
export async function PATCH(request: Request, context: Ctx) {
  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const isAdmin = await fetchIsPoolAdmin(admin, poolId, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: pool, error: poolError } = await admin
    .from('pools')
    .select(
      'id, name, description, accepting_members, theme_color, score_exact_points, score_winner_points, score_draw_points, scoring_style, scoring_locked_at',
    )
    .eq('id', poolId)
    .maybeSingle()

  if (poolError || !pool) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  const logs: Array<{
    action: string
    detail?: Record<string, unknown>
  }> = []

  if (typeof body.name === 'string') {
    const nameError = validatePoolName(body.name)
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    const trimmed = normalizePoolName(body.name)
    if (trimmed !== String(pool.name ?? '')) {
      updates.name = trimmed
      logs.push({
        action: 'name_edited',
        detail: { from: pool.name, to: trimmed },
      })
    }
  }

  if (body.description !== undefined) {
    const raw =
      body.description == null ? '' : String(body.description)
    const descError = validatePoolDescription(raw)
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }
    const nextDesc = normalizePoolDescription(raw) || null
    const prevDesc =
      typeof pool.description === 'string' && pool.description.trim()
        ? pool.description.trim()
        : null
    if (nextDesc !== prevDesc) {
      updates.description = nextDesc
      logs.push({
        action: 'description_edited',
        detail: { from: prevDesc, to: nextDesc },
      })
    }
  }

  if (typeof body.acceptingMembers === 'boolean') {
    const prev = pool.accepting_members ?? true
    if (body.acceptingMembers !== prev) {
      updates.accepting_members = body.acceptingMembers
      logs.push({
        action: body.acceptingMembers ? 'pool_opened' : 'pool_closed',
      })
    }
  }

  if (body.themeColor !== undefined) {
    const normalized =
      body.themeColor == null
        ? null
        : normalizePoolThemeColor(body.themeColor)
    if (body.themeColor != null && (!normalized || !isValidPoolThemeHex(normalized))) {
      return NextResponse.json(
        { error: 'invalid_theme_color' },
        { status: 400 },
      )
    }
    const prev =
      typeof pool.theme_color === 'string' ? pool.theme_color : null
    if (normalized !== prev) {
      updates.theme_color = normalized
      logs.push({
        action: 'theme_edited',
        detail: { from: prev, to: normalized },
      })
    }
  }

  const scoringTouched =
    body.scoreExactPoints !== undefined ||
    body.scoreWinnerPoints !== undefined ||
    body.scoreDrawPoints !== undefined

  let scoringRecalcNeeded = false
  let scoringVersion: number | null = null
  let matchesRescored: number | null = null

  if (scoringTouched) {
    if (pool.scoring_style === 'winner') {
      return NextResponse.json(
        { error: 'scoring_not_editable' },
        { status: 400 },
      )
    }

    const coerceOrDefault = (
      incoming: number | null | undefined,
      stored: unknown,
      fallback: number,
    ): unknown => {
      if (incoming !== undefined) {
        return incoming == null ? fallback : incoming
      }
      return stored == null ? fallback : stored
    }

    const validated = validateClassicScoringPoints({
      exact: coerceOrDefault(
        body.scoreExactPoints,
        pool.score_exact_points,
        CLASSIC_DEFAULT_EXACT_POINTS,
      ),
      winner: coerceOrDefault(
        body.scoreWinnerPoints,
        pool.score_winner_points,
        CLASSIC_DEFAULT_WINNER_POINTS,
      ),
      draw: coerceOrDefault(
        body.scoreDrawPoints,
        pool.score_draw_points,
        CLASSIC_DEFAULT_DRAW_POINTS,
      ),
    })
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const exact = scorePointsForDb(validated.exact, CLASSIC_DEFAULT_EXACT_POINTS)
    const winner = scorePointsForDb(
      validated.winner,
      CLASSIC_DEFAULT_WINNER_POINTS,
    )
    const draw = scorePointsForDb(validated.draw, CLASSIC_DEFAULT_DRAW_POINTS)

    const prevResolved = resolveClassicScorePoints({
      scoreExactPoints: pool.score_exact_points,
      scoreWinnerPoints: pool.score_winner_points,
      scoreDrawPoints: pool.score_draw_points,
    })
    const scoringChanged =
      prevResolved.exact !== validated.exact ||
      prevResolved.winner !== validated.winner ||
      prevResolved.draw !== validated.draw

    if (scoringChanged) {
      const { count: awardedCount } = await admin
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('pool_id', poolId)
        .gt('points_awarded', 0)

      const competitionStarted =
        Boolean(pool.scoring_locked_at) || (awardedCount ?? 0) > 0

      if (competitionStarted && !body.confirmRecalculate) {
        return NextResponse.json(
          {
            error: 'scoring_recalc_confirmation_required',
            needsConfirmation: true,
            message:
              'Changing scoring after matches have been played will recalculate everyone\'s points for this pool.',
          },
          { status: 409 },
        )
      }

      updates.score_exact_points = exact
      updates.score_winner_points = winner
      updates.score_draw_points = draw
      scoringRecalcNeeded = competitionStarted
      logs.push({
        action: 'scoring_edited',
        detail: {
          exact: validated.exact,
          winner: validated.winner,
          draw: validated.draw,
          recalculate: competitionStarted,
        },
      })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      success: true,
      unchanged: true,
      pool: {
        name: pool.name,
        description: pool.description ?? null,
        acceptingMembers: pool.accepting_members ?? true,
        themeColor: pool.theme_color ?? null,
        scoreExactPoints: pool.score_exact_points ?? null,
        scoreWinnerPoints: pool.score_winner_points ?? null,
        scoreDrawPoints: pool.score_draw_points ?? null,
      },
    })
  }

  // Never allow creator_id via this route.
  delete updates.creator_id

  const { data: updated, error: updateError } = await admin
    .from('pools')
    .update(updates)
    .eq('id', poolId)
    .select(
      'name, description, accepting_members, theme_color, score_exact_points, score_winner_points, score_draw_points, scoring_style',
    )
    .maybeSingle()

  if (updateError || !updated) {
    console.error('pool settings PATCH failed:', updateError?.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  for (const entry of logs) {
    await logPoolModeration(admin, {
      poolId,
      actorId: user.id,
      action: entry.action,
      detail: entry.detail ?? null,
    })
  }

  if (scoringTouched && logs.some((l) => l.action === 'scoring_edited')) {
    const resolved = resolveClassicScorePoints({
      scoreExactPoints: updated.score_exact_points,
      scoreWinnerPoints: updated.score_winner_points,
      scoreDrawPoints: updated.score_draw_points,
    })
    const { data: versionRaw, error: versionError } = await admin.rpc(
      'record_scoring_version',
      {
        p_actor_id: user.id,
        p_pool_id: poolId,
        p_style: updated.scoring_style ?? 'classic',
        p_exact: resolved.exact,
        p_winner: resolved.winner,
        p_draw: resolved.draw,
      },
    )
    if (versionError) {
      console.error('record_scoring_version failed:', versionError.message)
    } else if (typeof versionRaw === 'number') {
      scoringVersion = versionRaw
    } else if (versionRaw != null) {
      const n = Number(versionRaw)
      scoringVersion = Number.isFinite(n) ? n : null
    }

    if (scoringRecalcNeeded) {
      const { data: recalcRaw, error: recalcError } = await admin.rpc(
        'recalculate_pool_scoring',
        {
          p_actor_id: user.id,
          p_pool_id: poolId,
        },
      )
      if (recalcError) {
        console.error('recalculate_pool_scoring failed:', recalcError.message)
        return NextResponse.json(
          {
            success: true,
            warning: 'scoring_saved_recalc_failed',
            error: recalcError.message,
            scoringVersion,
            pool: {
              name: updated.name,
              description: updated.description ?? null,
              acceptingMembers: updated.accepting_members ?? true,
              themeColor: updated.theme_color ?? null,
              scoreExactPoints: updated.score_exact_points ?? null,
              scoreWinnerPoints: updated.score_winner_points ?? null,
              scoreDrawPoints: updated.score_draw_points ?? null,
            },
          },
          { status: 200 },
        )
      }
      if (typeof recalcRaw === 'number') {
        matchesRescored = recalcRaw
      } else if (recalcRaw && typeof recalcRaw === 'object') {
        const row = recalcRaw as Record<string, unknown>
        const n =
          row.matches_rescored ??
          row.matchesRescored ??
          row.count ??
          recalcRaw
        matchesRescored = typeof n === 'number' ? n : Number(n) || 0
      } else if (recalcRaw != null) {
        matchesRescored = Number(recalcRaw) || 0
      } else {
        matchesRescored = 0
      }
    }
  }

  return NextResponse.json({
    success: true,
    actions: logs.map((l) => l.action),
    scoringVersion,
    matchesRescored,
    recalculated: scoringRecalcNeeded,
    pool: {
      name: updated.name,
      description: updated.description ?? null,
      acceptingMembers: updated.accepting_members ?? true,
      themeColor: updated.theme_color ?? null,
      scoreExactPoints: updated.score_exact_points ?? null,
      scoreWinnerPoints: updated.score_winner_points ?? null,
      scoreDrawPoints: updated.score_draw_points ?? null,
    },
  })
}
