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
  scorePointsForDb,
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

  if (scoringTouched) {
    if (pool.scoring_style === 'winner') {
      return NextResponse.json(
        { error: 'scoring_not_editable' },
        { status: 400 },
      )
    }
    if (pool.scoring_locked_at) {
      return NextResponse.json(
        { error: 'scoring_locked' },
        { status: 403 },
      )
    }

    const exact = scorePointsForDb(
      body.scoreExactPoints ?? pool.score_exact_points,
      CLASSIC_DEFAULT_EXACT_POINTS,
    )
    const winner = scorePointsForDb(
      body.scoreWinnerPoints ?? pool.score_winner_points,
      CLASSIC_DEFAULT_WINNER_POINTS,
    )
    const draw = scorePointsForDb(
      body.scoreDrawPoints ?? pool.score_draw_points,
      CLASSIC_DEFAULT_DRAW_POINTS,
    )

    updates.score_exact_points = exact
    updates.score_winner_points = winner
    updates.score_draw_points = draw
    logs.push({
      action: 'scoring_edited',
      detail: { exact, winner, draw },
    })
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
      'name, description, accepting_members, theme_color, score_exact_points, score_winner_points, score_draw_points',
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

  return NextResponse.json({
    success: true,
    actions: logs.map((l) => l.action),
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
