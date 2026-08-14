import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AI_INSIGHTS_MODEL,
  AI_INSIGHTS_REGEN_BLOCKED_MESSAGE,
  AI_INSIGHTS_REGEN_MAX,
  AI_INSIGHTS_REGEN_WINDOW_SEC,
  coerceStoredInsights,
  fetchCachedInsights,
  fetchInsightPayload,
  generateInsightsFromPayload,
  hashInsightPayload,
  isFreshCache,
  payloadHasFinalizedPredictions,
  upsertAiInsights,
  type InsightItem,
} from '@/src/lib/ai-insights'
import { checkDbRateLimit } from '@/src/lib/rate-limit'
import { requireProUser } from '@/src/lib/require-pro'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type InsightsOkBody = {
  isPro: true
  empty: boolean
  cached: boolean
  generatedAt: string | null
  model: string | null
  insights: InsightItem[]
  feedback: 'useful' | 'not_useful' | null
}

function emptyResponse(): NextResponse {
  const body: InsightsOkBody = {
    isPro: true,
    empty: true,
    cached: false,
    generatedAt: null,
    model: null,
    insights: [],
    feedback: null,
  }
  return NextResponse.json(body)
}

function okResponse(args: {
  insights: InsightItem[]
  cached: boolean
  generatedAt: string
  model: string | null
  feedback: 'useful' | 'not_useful' | null
}): NextResponse {
  const body: InsightsOkBody = {
    isPro: true,
    empty: false,
    cached: args.cached,
    generatedAt: args.generatedAt,
    model: args.model,
    insights: args.insights,
    feedback: args.feedback,
  }
  return NextResponse.json(body)
}

/**
 * build_insight_payload is EXECUTE service_role only — must use admin client.
 */
async function loadPayloadOrError(admin: SupabaseClient, userId: string) {
  const { payload, error } = await fetchInsightPayload(admin, userId)
  if (error) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'payload_failed', message: 'Could not build insight payload.' },
        { status: 500 },
      ),
    }
  }
  return { ok: true as const, payload }
}

async function forceGenerate(args: {
  admin: SupabaseClient
  userId: string
  payload: unknown
  statsHash: string
}) {
  let insights: InsightItem[]
  try {
    insights = await generateInsightsFromPayload(args.payload)
  } catch (err) {
    console.error('insights generation failed:', err)
    return NextResponse.json(
      {
        error: 'generation_failed',
        message: 'Could not generate insights. Please try again.',
      },
      { status: 502 },
    )
  }

  const { error: upsertError, generatedAt } = await upsertAiInsights(
    args.admin,
    {
      userId: args.userId,
      insights,
      statsHash: args.statsHash,
      model: AI_INSIGHTS_MODEL,
    },
  )
  if (upsertError) {
    return NextResponse.json(
      {
        error: 'persist_failed',
        message: 'Insights generated but could not be saved. Please retry.',
      },
      { status: 500 },
    )
  }

  return okResponse({
    insights,
    cached: false,
    generatedAt,
    model: AI_INSIGHTS_MODEL,
    feedback: null,
  })
}

/**
 * Lazy on-view insights: return 7-day matching cache, else generate.
 * All ai_insights / payload DB access uses service role; session is auth only.
 */
export async function GET() {
  const gate = await requireProUser()
  if (!gate.ok) return gate.response
  const { userId } = gate
  const admin = createAdminSupabaseClient()

  const loaded = await loadPayloadOrError(admin, userId)
  if (!loaded.ok) return loaded.response
  const { payload } = loaded

  if (!payloadHasFinalizedPredictions(payload)) {
    return emptyResponse()
  }

  const statsHash = hashInsightPayload(payload)
  const cached = await fetchCachedInsights(admin, userId)
  if (cached && isFreshCache(cached, statsHash)) {
    const insights = coerceStoredInsights(cached.insights)
    if (insights) {
      return okResponse({
        insights,
        cached: true,
        generatedAt: cached.generated_at,
        model: cached.model,
        feedback: cached.feedback,
      })
    }
  }

  return forceGenerate({ admin, userId, payload, statsHash })
}

/**
 * Manual regenerate — max 3/day via check_rate_limit.
 */
export async function POST() {
  const gate = await requireProUser()
  if (!gate.ok) return gate.response
  const { userId } = gate
  const admin = createAdminSupabaseClient()

  const allowed = await checkDbRateLimit(admin, {
    action: 'insight_regen',
    subject: userId,
    max: AI_INSIGHTS_REGEN_MAX,
    windowSeconds: AI_INSIGHTS_REGEN_WINDOW_SEC,
  })
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: AI_INSIGHTS_REGEN_BLOCKED_MESSAGE,
      },
      { status: 429 },
    )
  }

  const loaded = await loadPayloadOrError(admin, userId)
  if (!loaded.ok) return loaded.response
  const { payload } = loaded

  if (!payloadHasFinalizedPredictions(payload)) {
    return emptyResponse()
  }

  const statsHash = hashInsightPayload(payload)
  return forceGenerate({ admin, userId, payload, statsHash })
}
