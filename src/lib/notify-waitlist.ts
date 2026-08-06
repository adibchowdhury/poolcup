const NTFY_WAITLIST_TOPIC =
  process.env.NTFY_WAITLIST_TOPIC?.trim() ||
  process.env.NTFY_OPS_TOPIC?.trim() ||
  'poolcup-ops'
const NTFY_SERVER = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(
  /\/$/,
  '',
)

export type WaitlistNtfyPayload = {
  email: string
  ref: string | null
  /** 1-based signup ordinal when countable; omit if unknown. */
  count?: number | null
}

function buildNtfyBody({ email, ref, count }: WaitlistNtfyPayload): string {
  const lines = [`Email: ${email}`]
  if (ref) {
    lines.push(`Ref: ${ref}`)
  } else {
    lines.push('Ref: (none)')
  }
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    lines.push(`Signup #${count}`)
  }
  return lines.join('\n')
}

/** Posts to the waitlist ntfy topic using header-based publish format. */
export async function sendWaitlistNtfy(
  payload: WaitlistNtfyPayload,
): Promise<void> {
  const title =
    typeof payload.count === 'number' &&
    Number.isFinite(payload.count) &&
    payload.count > 0
      ? `New PoolCup waitlist signup #${payload.count} 🎉`
      : 'New PoolCup waitlist signup 🎉'

  const headers: Record<string, string> = {
    Title: title,
    Tags: 'tada,email',
  }

  const authToken = process.env.NTFY_AUTH_TOKEN?.trim()
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${NTFY_SERVER}/${NTFY_WAITLIST_TOPIC}`, {
    method: 'POST',
    headers,
    body: buildNtfyBody(payload),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `ntfy waitlist publish failed (${response.status})${detail ? `: ${detail}` : ''}`,
    )
  }
}
