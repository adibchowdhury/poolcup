import { secureCompare } from '@/src/lib/secure-compare'

/** Shared CRON_SECRET check for ingestion routes (Bearer or x-cron-secret). */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (bearerToken && secureCompare(bearerToken, cronSecret)) return true

  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader && secureCompare(cronHeader, cronSecret)) return true

  return false
}

export function requireCronSecretConfigured(): string | null {
  const cronSecret = process.env.CRON_SECRET?.trim()
  return cronSecret || null
}

/** Absolute origin for server-side cron re-triggers (admin retry). */
export function resolveAppOrigin(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (request) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    const host =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    if (host) return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}

export async function invokeCronRoute(
  path: string,
  options?: { origin?: string; searchParams?: Record<string, string> },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const cronSecret = requireCronSecretConfigured()
  if (!cronSecret) {
    return {
      ok: false,
      status: 500,
      body: { error: 'CRON_SECRET is not configured' },
    }
  }

  const origin = options?.origin ?? resolveAppOrigin()
  const url = new URL(path.startsWith('/') ? path : `/${path}`, origin)
  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = { error: 'Non-JSON response' }
  }

  return { ok: res.ok, status: res.status, body }
}
