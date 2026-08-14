import type { SupabaseClient } from '@supabase/supabase-js'

/** Invite-code lookup / join attempts: 20 per hour per subject. */
export const INVITE_ATTEMPT_MAX = 20
export const INVITE_ATTEMPT_WINDOW_SEC = 3600

/** User search: 30 per minute per authenticated user. */
export const USER_SEARCH_MAX = 30
export const USER_SEARCH_WINDOW_SEC = 60

export const INVITE_RATE_LIMIT_MESSAGE =
  'Too many attempts, try again later'

export const USER_SEARCH_RATE_LIMIT_MESSAGE = 'Slow down. Try again shortly.'

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.trim()
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Durable DB rate limiter (service_role). Returns true when allowed (and recorded).
 * On RPC failure, fail open so legit traffic is not blocked by infra blips.
 */
export async function checkDbRateLimit(
  service: SupabaseClient,
  params: {
    action: string
    subject: string
    max: number
    windowSeconds: number
  },
): Promise<boolean> {
  const subject = params.subject.trim() || 'unknown'
  const { data, error } = await service.rpc('check_rate_limit', {
    p_action: params.action,
    p_subject: subject,
    p_max: params.max,
    p_window_seconds: params.windowSeconds,
  })

  if (error) {
    console.error('check_rate_limit failed:', error.message)
    return true
  }

  return data === true
}
