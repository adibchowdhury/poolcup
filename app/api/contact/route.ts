import { NextResponse } from 'next/server'
import { sendContactFormEmail } from '@/src/lib/emails/contact'

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const MAX_NAME_LENGTH = 100
const MAX_MESSAGE_LENGTH = 5000

// Soft best-effort in-memory limiter; resets per serverless instance — replace with a durable limiter later.
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  let body: {
    firstName?: string
    lastName?: string
    email?: string
    message?: string
    company?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.company?.trim()) {
    return NextResponse.json({ success: true })
  }

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const firstName = body.firstName?.trim() ?? ''
  const lastName = body.lastName?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  const message = body.message?.trim() ?? ''

  if (!firstName || !lastName || !email || !message) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'Name is too long' }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const { error } = await sendContactFormEmail({
    firstName,
    lastName,
    email,
    message,
  })

  if (error) {
    console.error('contact form send failed:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
