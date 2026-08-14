import { NextResponse } from 'next/server'
import { persistInsightFeedback } from '@/src/lib/ai-insights'
import { requireProUser } from '@/src/lib/require-pro'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FeedbackBody = {
  feedback?: unknown
}

/**
 * Persist useful / not_useful feedback for the current user's AI insights.
 * Identity from session; ai_insights write via service role (RLS blocks user).
 */
export async function POST(request: Request) {
  const gate = await requireProUser()
  if (!gate.ok) return gate.response
  const { userId } = gate

  let body: FeedbackBody
  try {
    body = (await request.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const feedback = body.feedback
  if (feedback !== 'useful' && feedback !== 'not_useful') {
    return NextResponse.json(
      {
        error: 'invalid_feedback',
        message: "feedback must be 'useful' or 'not_useful'",
      },
      { status: 400 },
    )
  }

  const admin = createAdminSupabaseClient()
  const { error } = await persistInsightFeedback(admin, userId, feedback)

  if (error) {
    return NextResponse.json(
      {
        error: 'feedback_failed',
        message: 'Could not save feedback. Please try again.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    feedback,
  })
}
