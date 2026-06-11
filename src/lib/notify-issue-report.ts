const NTFY_TOPIC = process.env.NTFY_TOPIC ?? 'poolcup-bugs'
const NTFY_SERVER = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/$/, '')

export const ANONYMOUS_REPORTER_LABEL = 'Anonymous (no contact info)'

export type ReporterContact = {
  name: string
  email: string
}

export function resolveReporterContact(
  profile: { display_name?: string | null; email?: string | null } | null,
  sessionEmail: string | null | undefined,
  formContact?: { name?: string; email?: string },
): ReporterContact {
  const formName = formContact?.name?.trim()
  const formEmail = formContact?.email?.trim()

  const name =
    profile?.display_name?.trim() || formName || ANONYMOUS_REPORTER_LABEL
  const email =
    profile?.email?.trim() ||
    sessionEmail?.trim() ||
    formEmail ||
    '(no email)'

  return { name, email }
}

export type IssueReportNtfyPayload = {
  reporter: ReporterContact
  message: string
  pageUrl: string
}

function buildNtfyBody({ reporter, message, pageUrl }: IssueReportNtfyPayload): string {
  return [
    `Name: ${reporter.name}`,
    `Email: ${reporter.email}`,
    `Page: ${pageUrl}`,
    '',
    message,
  ].join('\n')
}

/** Posts to the poolcup-bugs ntfy topic using header-based publish format. */
export async function sendIssueReportNtfy(
  payload: IssueReportNtfyPayload,
): Promise<void> {
  const headers: Record<string, string> = {
    Title: `Bug report from ${payload.reporter.name}`,
    Tags: 'bug',
  }

  const authToken = process.env.NTFY_AUTH_TOKEN?.trim()
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
    method: 'POST',
    headers,
    body: buildNtfyBody(payload),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `ntfy publish failed (${response.status})${detail ? `: ${detail}` : ''}`,
    )
  }
}
