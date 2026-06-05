import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/src/lib/emails/welcome'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type HandleNewUserBody = {
  userId?: string
  email?: string
  firstName?: string
}

function isInternalRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return Boolean(
    serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`,
  )
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleNewUserBody
    const userId = body.userId
    const email = body.email?.trim()
    const firstName = body.firstName?.trim() || 'there'

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 },
      )
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
      return NextResponse.json({ error: authUserError.message }, { status: 500 })
    }

    if (authUser.user.app_metadata?.welcome_email_sent) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const { error: emailError } = await sendWelcomeEmail({ email, firstName })

    if (emailError) {
      console.error('handle-new-user welcome email error:', emailError.message)
      return NextResponse.json({ error: emailError.message }, { status: 500 })
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
