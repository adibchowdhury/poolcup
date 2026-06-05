import { Resend } from 'resend'

type SendWelcomeEmailParams = {
  email: string
  firstName: string
}

function buildWelcomeEmailHtml(firstName: string): string {
  const greetingName = firstName.trim() || 'there'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to PoolCup</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e13;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px;font-weight:700;letter-spacing:0.12em;color:#00e676;">POOLCUP</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;line-height:1.3;">Welcome to PoolCup 🏆</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;color:#ffffff;font-size:16px;line-height:1.7;">
              Hey ${greetingName}, You&apos;re in. PoolCup is the easiest way to run a prediction pool with your friends — everyone predicts, the leaderboard updates automatically, and one person gets crowned the winner.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <a href="https://www.getpoolcup.com" style="display:inline-block;background-color:#00e676;color:#0a0e13;font-weight:600;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;">Create Your Pool</a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="color:#ffffff;font-size:14px;line-height:1.5;padding:0 8px;">
                    <span style="display:block;color:#00e676;font-size:20px;margin-bottom:8px;">1</span>
                    Create a pool
                  </td>
                  <td width="33%" align="center" style="color:#ffffff;font-size:14px;line-height:1.5;padding:0 8px;">
                    <span style="display:block;color:#00e676;font-size:20px;margin-bottom:8px;">2</span>
                    Invite your squad
                  </td>
                  <td width="33%" align="center" style="color:#ffffff;font-size:14px;line-height:1.5;padding:0 8px;">
                    <span style="display:block;color:#00e676;font-size:20px;margin-bottom:8px;">3</span>
                    Make your predictions
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="color:#8b9cb3;font-size:14px;line-height:1.7;">
              — The PoolCup Team<br />
              <a href="https://www.getpoolcup.com" style="color:#00e676;text-decoration:none;">getpoolcup.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendWelcomeEmail({
  email,
  firstName,
}: SendWelcomeEmailParams): Promise<{ error: Error | null }> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return { error: new Error('RESEND_API_KEY is not configured') }
  }

  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'hello@getpoolcup.com',
    to: email,
    subject: 'Welcome to PoolCup 🏆',
    html: buildWelcomeEmailHtml(firstName),
  })

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}
