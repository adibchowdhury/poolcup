import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendWaitlistNtfy } from '@/src/lib/notify-waitlist'
import {
  isReferralUuid,
  POOLCUP_REF_COOKIE,
} from '@/src/lib/referral'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 8

// Soft best-effort in-memory limiter; resets per serverless instance.
const submissionsByIp = new Map<string, number[]>()

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.trim()
  if (!forwarded) return 'unknown'
  const firstIp = forwarded.split(',')[0]?.trim()
  return firstIp || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = submissionsByIp.get(ip) ?? []
  const recent = timestamps.filter((t) => t > windowStart)
  if (recent.length >= RATE_LIMIT_MAX) {
    submissionsByIp.set(ip, recent)
    return true
  }
  recent.push(now)
  submissionsByIp.set(ip, recent)
  return false
}

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

type JoinWaitlistBody = {
  email?: string
  ref?: string | null
}

export async function POST(request: Request) {
  let body: JoinWaitlistBody
  try {
    body = (await request.json()) as JoinWaitlistBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const email = body.email?.trim() ?? ''
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const cookieRef = cookieStore.get(POOLCUP_REF_COOKIE)?.value
  const bodyRef = typeof body.ref === 'string' ? body.ref : null
  const p_ref = isReferralUuid(cookieRef)
    ? cookieRef.trim()
    : isReferralUuid(bodyRef)
      ? bodyRef.trim()
      : null

  let supabase
  try {
    supabase = createAdminSupabaseClient()
  } catch (error) {
    console.error('join-waitlist: admin client unavailable', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 },
    )
  }

  const { error: rpcError } = await supabase.rpc('join_waitlist', {
    p_email: email,
    p_ref,
  })

  if (rpcError) {
    console.error('join_waitlist failed:', rpcError)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 },
    )
  }

  // Best-effort count + ntfy — never fail the signup if these blow up.
  try {
    let count: number | null = null
    const { count: waitlistCount, error: countError } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('join-waitlist: count failed', countError)
    } else if (typeof waitlistCount === 'number') {
      count = waitlistCount
    }

    await sendWaitlistNtfy({ email, ref: p_ref, count })
  } catch (notifyError) {
    console.error('join-waitlist: ntfy failed', notifyError)
  }

  return NextResponse.json({ ok: true })
}
