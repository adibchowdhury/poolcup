/** Shared referral helpers (invite links + cookie + new-user gate). */

export const POOLCUP_REF_COOKIE = 'poolcup_ref'
/** ~21 days — long enough for click → signup, short enough to expire stale refs. */
export const POOLCUP_REF_MAX_AGE_SECONDS = 60 * 60 * 24 * 21
export const REFERRAL_SOURCE_INVITE_LINK = 'invite_link'
/** Google / first-session: treat as new only within this window. */
export const NEW_AUTH_USER_MAX_AGE_MS = 5 * 60 * 1000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isReferralUuid(value: string | null | undefined): value is string {
  if (!value) return false
  return UUID_RE.test(value.trim())
}

export function buildJoinInviteUrl(
  origin: string,
  inviteCode: string,
  referrerUserId?: string | null,
): string {
  const base = `${origin.replace(/\/$/, '')}/join/${inviteCode}`
  if (!isReferralUuid(referrerUserId)) return base
  return `${base}?ref=${encodeURIComponent(referrerUserId.trim())}`
}

export function isLikelyNewAuthUser(
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!createdAt) return false
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return false
  const ageMs = nowMs - createdMs
  return ageMs <= NEW_AUTH_USER_MAX_AGE_MS && ageMs >= -60_000
}

/** Client-only: read poolcup_ref from document.cookie. */
export function readPoolcupRefCookieClient(): string | null {
  if (typeof document === 'undefined') return null
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [rawName, ...rest] = part.split('=')
    if (rawName?.trim() !== POOLCUP_REF_COOKIE) continue
    const value = decodeURIComponent(rest.join('=').trim())
    return isReferralUuid(value) ? value.trim() : null
  }
  return null
}

/** Client-only: clear poolcup_ref (best-effort). */
export function clearPoolcupRefCookieClient(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${POOLCUP_REF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

/**
 * Fire-and-forget referral record after a NEW account is created.
 * NEVER throws; NEVER blocks signup. Safe to call without awaiting.
 */
export function fireRecordReferralBestEffort(referredId: string): void {
  try {
    if (typeof window === 'undefined') return
    if (!isReferralUuid(referredId)) return

    const referrerId = readPoolcupRefCookieClient()
    if (!referrerId || referrerId === referredId) return

    void fetch('/api/record-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ referredId: referredId.trim() }),
    })
      .then((res) => {
        if (res.ok) clearPoolcupRefCookieClient()
      })
      .catch(() => {
        /* best-effort — never surface */
      })
  } catch {
    /* best-effort — never surface */
  }
}
