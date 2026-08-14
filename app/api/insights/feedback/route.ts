import { NextResponse } from 'next/server'
import { requireProUser } from '@/src/lib/require-pro'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FeedbackBody = {
  feedback?: unknown
}

/**
 * Persist useful / not_useful feedback for the current user's AI insights.
 */
export async function POST(request: Request) {
  const gate = await requireProUser()
  if (!gate.ok) return gate.response
  const { supabase, userId } = gate

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

  const { error } = await supabase.rpc('set_insight_feedback', {
    p_user_id: userId,
    p_feedback: feedback,
  })

  if (error) {
    console.error('set_insight_feedback failed:', error.message)
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
