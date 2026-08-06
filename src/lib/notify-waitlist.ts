export type WaitlistNtfyPayload = {
  email: string
  ref: string | null
  /** 1-based signup ordinal when countable; omit if unknown. */
  count?: number | null
}

function resolveWaitlistNtfyConfig(): {
  server: string
  topic: string
  url: string
  hasAuthToken: boolean
} {
  // Read at call time (not module load) so .env.local / Vercel env is current.
  const topic =
    process.env.NTFY_WAITLIST_TOPIC?.trim() ||
    process.env.NTFY_OPS_TOPIC?.trim() ||
    'poolcup-ops'
  const server = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(
    /\/$/,
    '',
  )
  return {
    server,
    topic,
    url: `${server}/${topic}`,
    hasAuthToken: Boolean(process.env.NTFY_AUTH_TOKEN?.trim()),
  }
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

/**
 * Posts to the waitlist ntfy topic using header-based publish format.
 * Title/Tags must be ASCII ByteStrings — do NOT put emoji in headers
 * (undici/fetch throws; ntfy shows 🎉 via the `tada` tag instead).
 */
export async function sendWaitlistNtfy(
  payload: WaitlistNtfyPayload,
): Promise<void> {
  const { topic, url, hasAuthToken } = resolveWaitlistNtfyConfig()

  const title =
    typeof payload.count === 'number' &&
    Number.isFinite(payload.count) &&
    payload.count > 0
      ? `New PoolCup waitlist signup #${payload.count}`
      : 'New PoolCup waitlist signup'

  const headers: Record<string, string> = {
    Title: title,
    Tags: 'tada,email',
  }

  const authToken = process.env.NTFY_AUTH_TOKEN?.trim()
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  console.log('join-waitlist ntfy: sending', {
    url,
    topic,
    hasAuthToken,
    title,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: buildNtfyBody(payload),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('join-waitlist ntfy: publish failed', {
      status: response.status,
      detail: detail.slice(0, 500),
      url,
      topic,
    })
    throw new Error(
      `ntfy waitlist publish failed (${response.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  console.log('join-waitlist ntfy: ok', {
    status: response.status,
    url,
    topic,
  })
}
