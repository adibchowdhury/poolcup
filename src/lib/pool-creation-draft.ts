import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizePoolDescription,
  normalizePoolName,
  validatePoolDescription,
  validatePoolName,
} from '@/src/lib/pool-name'
import { normalizePoolThemeColor } from '@/src/lib/pool-theme'
import type { PoolScoringStyleId } from '@/src/lib/scoring-style-display'
import { POOL_SCORING_STYLE_OPTIONS } from '@/src/lib/scoring-style-display'

const CREATABLE_STATUSES = new Set(['live', 'upcoming'])
const SCORING_IDS = new Set(
  POOL_SCORING_STYLE_OPTIONS.map((option) => option.id),
)

export type PoolCreationDraftPayload = {
  name: string
  description: string | null
  scoringStyle: PoolScoringStyleId
  eventId: string
  eventName: string
  isPublic: boolean
  themeColor: string | null
  /** Client will upload emblem after pool exists (finalizing state). */
  hasPendingEmblem: boolean
}

export type ValidatedPoolCreationDraft = {
  name: string
  description: string | null
  scoringStyle: PoolScoringStyleId
  eventId: string
  eventName: string
  isPublic: boolean
  themeColor: string | null
  hasPendingEmblem: boolean
}

export type DraftValidationResult =
  | { ok: true; payload: ValidatedPoolCreationDraft }
  | { ok: false; error: string; field?: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Validate a draft payload exactly as pool creation would — so checkout
 * drafts cannot fail materialization later for name/event/scoring reasons.
 */
export async function validatePoolCreationDraftPayload(
  admin: SupabaseClient,
  raw: unknown,
): Promise<DraftValidationResult> {
  const body = asRecord(raw)
  if (!body) {
    return { ok: false, error: 'invalid_payload' }
  }

  const name =
    typeof body.name === 'string' ? body.name : String(body.name ?? '')
  const nameError = validatePoolName(name)
  if (nameError) {
    return { ok: false, error: nameError, field: 'name' }
  }

  const descriptionRaw =
    typeof body.description === 'string'
      ? body.description
      : body.description == null
        ? ''
        : String(body.description)
  const descriptionError = validatePoolDescription(descriptionRaw)
  if (descriptionError) {
    return { ok: false, error: descriptionError, field: 'description' }
  }

  const scoringStyle =
    typeof body.scoringStyle === 'string'
      ? body.scoringStyle
      : typeof body.scoring_style === 'string'
        ? body.scoring_style
        : ''
  if (!SCORING_IDS.has(scoringStyle as PoolScoringStyleId)) {
    return { ok: false, error: 'invalid_scoring_style', field: 'scoringStyle' }
  }

  const eventId =
    typeof body.eventId === 'string'
      ? body.eventId.trim()
      : typeof body.event_id === 'string'
        ? body.event_id.trim()
        : ''
  if (!eventId) {
    return { ok: false, error: 'event_required', field: 'eventId' }
  }

  const { data: event, error: eventError } = await admin
    .from('sporting_events')
    .select('id, name, status')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    return { ok: false, error: 'event_lookup_failed' }
  }
  if (!event) {
    return { ok: false, error: 'event_not_found', field: 'eventId' }
  }
  if (!CREATABLE_STATUSES.has(String(event.status))) {
    return { ok: false, error: 'event_not_creatable', field: 'eventId' }
  }

  const isPublic = Boolean(body.isPublic ?? body.is_public)

  let themeColor: string | null = null
  const themeRaw = body.themeColor ?? body.theme_color
  if (typeof themeRaw === 'string' && themeRaw.trim()) {
    themeColor = normalizePoolThemeColor(themeRaw)
    if (!themeColor) {
      return { ok: false, error: 'invalid_theme_color', field: 'themeColor' }
    }
  }

  const hasPendingEmblem = Boolean(
    body.hasPendingEmblem ?? body.has_pending_emblem,
  )

  return {
    ok: true,
    payload: {
      name: normalizePoolName(name),
      description: normalizePoolDescription(descriptionRaw) || null,
      scoringStyle: scoringStyle as PoolScoringStyleId,
      eventId: event.id as string,
      eventName: String(event.name ?? ''),
      isPublic,
      themeColor,
      hasPendingEmblem,
    },
  }
}

export type MaterializedPool = {
  id: string
  inviteCode: string
  name: string
  isPublic: boolean
}

/**
 * Create a Custom Pool (+ creator membership) from a validated draft payload.
 * Caller owns purchase ledger + draft consumption.
 */
export async function materializePoolFromDraft(
  admin: SupabaseClient,
  userId: string,
  payload: ValidatedPoolCreationDraft,
): Promise<MaterializedPool> {
  const { data: pool, error: insertError } = await admin
    .from('pools')
    .insert({
      name: payload.name,
      description: payload.description,
      scoring_style: payload.scoringStyle,
      event_name: payload.eventName,
      event_id: payload.eventId,
      creator_id: userId,
      is_public: payload.isPublic,
      plan: 'custom',
      theme_color: payload.themeColor,
    })
    .select('id, invite_code, is_public, name')
    .single()

  if (insertError || !pool) {
    throw new Error(
      `draft pool insert failed: ${insertError?.message ?? 'unknown'}`,
    )
  }

  const { data: profile } = await admin
    .from('users')
    .select('display_name, email')
    .eq('id', userId)
    .maybeSingle()

  let displayName = profile?.display_name?.trim()
  if (!displayName) {
    const emailUsername =
      typeof profile?.email === 'string'
        ? profile.email.split('@')[0]?.trim()
        : ''
    displayName = emailUsername || 'Pool creator'
  }

  const { error: memberError } = await admin.from('pool_members').insert({
    pool_id: pool.id,
    user_id: userId,
    display_name: displayName,
  })

  if (memberError) {
    throw new Error(`draft pool member insert failed: ${memberError.message}`)
  }

  const { error: pointsError } = await admin.rpc('award_pool_creation_points', {
    p_pool_id: pool.id,
  })
  if (pointsError) {
    console.error(
      'materializePoolFromDraft: award_pool_creation_points failed',
      pointsError.message,
    )
  }

  const inviteCode =
    typeof pool.invite_code === 'string' ? pool.invite_code.trim() : ''
  if (!inviteCode) {
    throw new Error('draft pool missing invite_code after insert')
  }

  return {
    id: pool.id as string,
    inviteCode,
    name: String(pool.name ?? payload.name),
    isPublic: Boolean(pool.is_public),
  }
}
