import { Resend } from 'resend'
import { TRANSACTIONAL_EMAIL_FROM } from '@/src/lib/emails/from'

const SUPPORT_EMAIL = 'support@getpoolcup.com'

type SendContactFormEmailParams = {
  firstName: string
  lastName: string
  email: string
  message: string
}

export async function sendContactFormEmail(
  params: SendContactFormEmailParams,
): Promise<{ error: Error | null }> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return { error: new Error('RESEND_API_KEY is not configured') }
  }

  const resend = new Resend(apiKey)
  const name = `${params.firstName} ${params.lastName}`.trim()

  const { error } = await resend.emails.send({
    from: TRANSACTIONAL_EMAIL_FROM,
    to: SUPPORT_EMAIL,
    replyTo: params.email,
    subject: `Contact form: ${name || params.email}`,
    text: [
      `Name: ${name}`,
      `Email: ${params.email}`,
      '',
      params.message,
    ].join('\n'),
  })

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}
