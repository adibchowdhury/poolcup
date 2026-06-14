const NTFY_OPS_TOPIC = process.env.NTFY_OPS_TOPIC ?? 'poolcup-ops'
const NTFY_SERVER = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/$/, '')

/** Posts to the ops ntfy topic using header-based publish format. */
export async function sendOpsNtfy(message: string): Promise<void> {
  const headers: Record<string, string> = {
    Title: 'PoolCup ops',
    Tags: 'ops,cron',
  }

  const authToken = process.env.NTFY_AUTH_TOKEN?.trim()
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${NTFY_SERVER}/${NTFY_OPS_TOPIC}`, {
    method: 'POST',
    headers,
    body: message,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `ntfy ops publish failed (${response.status})${detail ? `: ${detail}` : ''}`,
    )
  }
}
