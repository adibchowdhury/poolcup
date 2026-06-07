import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/src/lib/emails/welcome'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { secureCompare } from '@/src/lib/secure-compare'

type HandleNewUserBody = {
  userId?: string
}

function isInternalRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET
  if (!internalSecret) return false
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (!bearerToken) return false
  return secureCompare(bearerToken, internalSecret)
}

function deriveFirstName(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string {
  if (metadata) {
    const firstName =
      typeof metadata.first_name === 'string' ? metadata.first_name.trim() : ''
    if (firstName) return firstName

    const fullName =
      typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
    if (fullName) {
      const part = fullName.split(/\s+/)[0]
      if (part) return part
    }

    const name = typeof metadata.name === 'string' ? metadata.name.trim() : ''
    if (name) {
      const part = name.split(/\s+/)[0]
      if (part) return part
    }
  }

  const localPart = email?.split('@')[0]?.trim()
  return localPart || 'there'
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleNewUserBody
    const userId = body.userId

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!isInternalRequest(request)) {
      const supabase = await createServerSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || user.id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const admin = createAdminSupabaseClient()
    const { data: authUser, error: authUserError } =
      await admin.auth.admin.getUserById(userId)

    if (authUserError) {
      console.error('handle-new-user: failed to load auth user', {
        userId,
        error: authUserError,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const email = authUser.user.email?.trim()
    if (!email) {
      return NextResponse.json(
        { error: 'User has no email address' },
        { status: 400 },
      )
    }

    const firstName = deriveFirstName(
      authUser.user.user_metadata as Record<string, unknown> | undefined,
      email,
    )

    if (authUser.user.app_metadata?.welcome_email_sent) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const { error: emailError } = await sendWelcomeEmail({ email, firstName })

    if (emailError) {
      console.error('handle-new-user welcome email error:', emailError.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      {
        app_metadata: {
          ...authUser.user.app_metadata,
          welcome_email_sent: true,
        },
      },
    )

    if (updateError) {
      console.error('handle-new-user metadata update error:', updateError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('handle-new-user error:', error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
