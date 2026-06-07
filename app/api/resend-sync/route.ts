import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { secureCompare } from '@/src/lib/secure-compare'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  // Confirm the request actually came from Supabase
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.SUPABASE_WEBHOOK_SECRET
  if (!expected || !secret || !secureCompare(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json()
  const record = payload?.record
  const email = record?.email
  if (!email) {
    return NextResponse.json({ error: 'No email in payload' }, { status: 400 })
  }

  // Best effort first name from OAuth or signup metadata
  const meta = record?.raw_user_meta_data ?? {}
  const firstName =
    meta.first_name ||
    (meta.full_name ? String(meta.full_name).split(' ')[0] : undefined) ||
    (meta.name ? String(meta.name).split(' ')[0] : undefined)

  const { error } = await resend.contacts.create({
    email,
    firstName,
    unsubscribed: false,
    audienceId: process.env.RESEND_AUDIENCE_ID!,
  })

  if (error) {
    console.error('Resend contact create failed:', error)
    return NextResponse.json({ error: 'Resend failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
