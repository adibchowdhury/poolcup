import { NextResponse } from 'next/server'
import {
  resolveReporterContact,
  sendIssueReportNtfy,
} from '@/src/lib/notify-issue-report'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type ReportIssueBody = {
  message?: string
  page_url?: string
  user_agent?: string
  metadata?: Record<string, unknown>
  contact_name?: string
  contact_email?: string
}

export async function POST(request: Request) {
  let body: ReportIssueBody
  try {
    body = (await request.json()) as ReportIssueBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = body.message?.trim()
  const pageUrl = body.page_url?.trim()

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (!pageUrl) {
    return NextResponse.json({ error: 'page_url is required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let reporter = resolveReporterContact(null, null, {
    name: body.contact_name,
    email: body.contact_email,
  })

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle()

    reporter = resolveReporterContact(profile, user.email, {
      name: body.contact_name,
      email: body.contact_email,
    })

    const { error: insertError } = await supabase.from('issue_reports').insert({
      message,
      user_id: user.id,
      page_url: pageUrl,
      user_agent: body.user_agent ?? null,
      metadata: body.metadata ?? {},
    })

    if (insertError) {
      console.error('issue_reports insert failed:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Failed to save report' },
        { status: 500 },
      )
    }
  }

  try {
    await sendIssueReportNtfy({
      reporter,
      message,
      pageUrl,
    })
  } catch (error) {
    console.error('issue report ntfy failed:', error)
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to send report notification' },
        { status: 502 },
      )
    }
  }

  return NextResponse.json({ success: true })
}
