import 'server-only'
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INSIGHT_TYPES,
  type InsightFeedback,
  type InsightItem,
  type InsightType,
} from '@/src/lib/ai-insights-shared'

export {
  formatGeneratedAgo,
  INSIGHT_TYPES,
  type InsightFeedback,
  type InsightItem,
  type InsightType,
} from '@/src/lib/ai-insights-shared'

export const AI_INSIGHTS_MODEL = 'claude-haiku-4-5-20251001'
export const AI_INSIGHTS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AI_INSIGHTS_REGEN_MAX = 3
export const AI_INSIGHTS_REGEN_WINDOW_SEC = 86_400
export const AI_INSIGHTS_REGEN_BLOCKED_MESSAGE =
  "You've regenerated your insights a few times today. Try again tomorrow."

export type AiInsightsRow = {
  user_id: string
  insights: unknown
  stats_hash: string
  model: string | null
  generated_at: string
  feedback: InsightFeedback | null
  feedback_at: string | null
}

const SYSTEM_PROMPT =
  'You are a sports-prediction coach. Using ONLY this user\'s own aggregate stats, produce exactly 4 concise, specific, actionable insights to help them predict better. Types: weekly_summary, strongest_sport, weakest_area, recent_form. Respond ONLY as JSON: {"insights":[{"type","title","body"}]}. Cite their actual numbers. If a category lacks data (e.g. weakest area needs >=10 predictions in a sport), give an encouraging \'keep predicting\' note. Never invent data not in the payload.'

function isInsightType(value: unknown): value is InsightType {
  return (
    typeof value === 'string' &&
    (INSIGHT_TYPES as readonly string[]).includes(value)
  )
}

/** Deterministic JSON for hashing (sorted object keys). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`
}

export function hashInsightPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

/**
 * All-time finalized count from build_insight_payload.
 * Live shape: `{ all_time: { finalized_predictions: N, ... }, last_7_days, ... }`.
 * Must NOT use range windows (last_7_days / last_30_days) — insights are all-time.
 */
export const AI_INSIGHTS_MIN_FINALIZED = 1

export function getAllTimeFinalizedCount(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const row = payload as Record<string, unknown>

  const allTime = row.all_time
  if (allTime && typeof allTime === 'object' && !Array.isArray(allTime)) {
    const at = allTime as Record<string, unknown>
    const nested = [
      at.finalized_predictions,
      at.finalized,
      at.total_finalized,
    ]
    for (const c of nested) {
      const n = typeof c === 'number' ? c : Number(c)
      if (Number.isFinite(n) && n >= 0) return n
    }
  }

  // Legacy / flat shapes (if payload ever flattens).
  const topLevel = [
    row.finalized_predictions,
    row.finalized,
    row.total_finalized,
    row.all_time_finalized,
  ]
  for (const c of topLevel) {
    const n = typeof c === 'number' ? c : Number(c)
    if (Number.isFinite(n) && n >= 0) return n
  }

  return null
}

/**
 * Empty ONLY when all-time finalized is known and below the minimum.
 * Unknown shapes with a non-empty payload proceed to generation (do not
 * false-empty on missing field names or range-scoped windows).
 */
export function payloadHasFinalizedPredictions(payload: unknown): boolean {
  const count = getAllTimeFinalizedCount(payload)
  if (count != null) {
    return count >= AI_INSIGHTS_MIN_FINALIZED
  }
  // Payload present but count field unknown — prefer generate over empty.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return Object.keys(payload as object).length > 0
  }
  return false
}

export function parseInsightsJson(raw: string): InsightItem[] | null {
  const trimmed = raw.trim()
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(withoutFences)
  } catch {
    const start = withoutFences.indexOf('{')
    const end = withoutFences.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      parsed = JSON.parse(withoutFences.slice(start, end + 1))
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const insightsRaw = (parsed as { insights?: unknown }).insights
  if (!Array.isArray(insightsRaw) || insightsRaw.length === 0) return null

  const items: InsightItem[] = []
  for (const entry of insightsRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    if (!isInsightType(row.type)) continue
    if (typeof row.title !== 'string' || !row.title.trim()) continue
    if (typeof row.body !== 'string' || !row.body.trim()) continue
    items.push({
      type: row.type,
      title: row.title.trim(),
      body: row.body.trim(),
    })
  }

  if (items.length === 0) return null

  // Prefer one of each type in declared order; fall back to first 4 valid.
  const byType = new Map<InsightType, InsightItem>()
  for (const item of items) {
    if (!byType.has(item.type)) byType.set(item.type, item)
  }
  const ordered = INSIGHT_TYPES.map((t) => byType.get(t)).filter(
    (x): x is InsightItem => Boolean(x),
  )
  if (ordered.length === INSIGHT_TYPES.length) return ordered
  return items.slice(0, 4)
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  return new Anthropic({ apiKey })
}

async function callClaudeOnce(payload: unknown): Promise<string> {
  const client = getAnthropicClient()
  const message = await client.messages.create({
    model: AI_INSIGHTS_MODEL,
    max_tokens: 700,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  })

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('empty_claude_response')
  }
  return text
}

/**
 * Generate 4 insights from build_insight_payload output only.
 * Retries once on JSON parse failure. Does not cache failures.
 */
export async function generateInsightsFromPayload(
  payload: unknown,
): Promise<InsightItem[]> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callClaudeOnce(payload)
      const parsed = parseInsightsJson(raw)
      if (parsed) return parsed
      lastError = new Error('insights_parse_failed')
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError ?? new Error('insights_generation_failed')
}

/**
 * Call build_insight_payload for a user.
 * MUST use the service-role client: EXECUTE was revoked from authenticated.
 */
export async function fetchInsightPayload(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ payload: unknown; error: string | null }> {
  const { data, error } = await adminClient.rpc('build_insight_payload', {
    p_user_id: userId,
  })
  if (error) {
    console.error('build_insight_payload failed:', error.message)
    return { payload: null, error: error.message }
  }
  return { payload: data ?? null, error: null }
}

/**
 * Load cached insights for a user.
 * MUST use the service-role client: `ai_insights` has RLS enabled with
 * zero policies, so authenticated SELECTs always return nothing (silent
 * cache miss → needless Claude regeneration).
 */
export async function fetchCachedInsights(
  adminClient: SupabaseClient,
  userId: string,
): Promise<AiInsightsRow | null> {
  const { data, error } = await adminClient
    .from('ai_insights')
    .select(
      'user_id, insights, stats_hash, model, generated_at, feedback, feedback_at',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('ai_insights load failed:', error.message)
    return null
  }
  return (data as AiInsightsRow | null) ?? null
}

export function isFreshCache(
  row: AiInsightsRow,
  statsHash: string,
  now = Date.now(),
): boolean {
  if (row.stats_hash !== statsHash) return false
  const generatedAt = new Date(row.generated_at).getTime()
  if (!Number.isFinite(generatedAt)) return false
  return now - generatedAt <= AI_INSIGHTS_CACHE_TTL_MS
}

export function coerceStoredInsights(raw: unknown): InsightItem[] | null {
  if (Array.isArray(raw)) {
    return parseInsightsJson(JSON.stringify({ insights: raw }))
  }
  if (raw && typeof raw === 'object') {
    return parseInsightsJson(JSON.stringify(raw))
  }
  if (typeof raw === 'string') {
    return parseInsightsJson(raw)
  }
  return null
}

/**
 * Upsert generated insights via service role only.
 * `ai_insights` is RLS-on / no policies — user clients cannot write either.
 */
export async function upsertAiInsights(
  adminClient: SupabaseClient,
  row: {
    userId: string
    insights: InsightItem[]
    statsHash: string
    model: string
  },
): Promise<{ error: string | null; generatedAt: string }> {
  const generatedAt = new Date().toISOString()
  const payload = {
    user_id: row.userId,
    insights: { insights: row.insights },
    stats_hash: row.statsHash,
    model: row.model,
    generated_at: generatedAt,
    // Clear stale feedback when regenerating fresh content.
    feedback: null,
    feedback_at: null,
  }

  const { error } = await adminClient.from('ai_insights').upsert(payload, {
    onConflict: 'user_id',
  })
  if (error) {
    console.error('ai_insights upsert (admin) failed:', error.message)
    return { error: error.message, generatedAt }
  }
  return { error: null, generatedAt }
}

/**
 * Persist useful/not_useful via service role (table is not user-readable/writable).
 * Prefers set_insight_feedback RPC; falls back to a direct row update.
 */
export async function persistInsightFeedback(
  adminClient: SupabaseClient,
  userId: string,
  feedback: InsightFeedback,
): Promise<{ error: string | null }> {
  const { error: rpcError } = await adminClient.rpc('set_insight_feedback', {
    p_user_id: userId,
    p_feedback: feedback,
  })
  if (!rpcError) return { error: null }

  console.error('set_insight_feedback (admin) failed:', rpcError.message)

  const feedbackAt = new Date().toISOString()
  const { error: updateError } = await adminClient
    .from('ai_insights')
    .update({ feedback, feedback_at: feedbackAt })
    .eq('user_id', userId)

  if (updateError) {
    console.error('ai_insights feedback update failed:', updateError.message)
    return { error: updateError.message }
  }
  return { error: null }
}
