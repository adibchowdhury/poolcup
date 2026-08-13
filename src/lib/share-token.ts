import { createHmac, timingSafeEqual } from 'node:crypto'

export type ShareTokenType = 'prediction' | 'leaderboard'

export type ShareTokenPayload = {
  type: ShareTokenType
  userId: string
  poolId: string
  matchId?: string
}

function getShareTokenSecret(): string | null {
  const secret =
    process.env.SHARE_TOKEN_SECRET?.trim() ||
    process.env.INTERNAL_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  return secret.length > 0 ? secret : null
}

/** Canonical string bound into the HMAC (order + fields matter). */
export function shareTokenMessage(payload: ShareTokenPayload): string {
  const userId = payload.userId.trim()
  const poolId = payload.poolId.trim()
  if (payload.type === 'prediction') {
    const matchId = payload.matchId?.trim() ?? ''
    return `v1|prediction|${userId}|${poolId}|${matchId}`
  }
  return `v1|leaderboard|${userId}|${poolId}`
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/**
 * Short URL-safe HMAC over the share payload.
 * Prefer SHARE_TOKEN_SECRET; falls back to INTERNAL_WEBHOOK_SECRET / CRON_SECRET.
 */
export function signShareToken(payload: ShareTokenPayload): string {
  const secret = getShareTokenSecret()
  if (!secret) {
    throw new Error('SHARE_TOKEN_SECRET (or INTERNAL_WEBHOOK_SECRET) is not set')
  }
  const digest = createHmac('sha256', secret)
    .update(shareTokenMessage(payload), 'utf8')
    .digest()
  // 16 bytes → ~22 chars; enough entropy for share URLs without bloating them
  return base64Url(digest.subarray(0, 16))
}

export function verifyShareToken(
  token: string | null | undefined,
  payload: ShareTokenPayload,
): boolean {
  if (!token?.trim()) return false
  const secret = getShareTokenSecret()
  if (!secret) return false

  let expected: string
  try {
    expected = signShareToken(payload)
  } catch {
    return false
  }

  const a = Buffer.from(token.trim())
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Build relative share image path with signed token (server-side). */
export function buildSignedShareImagePath(payload: ShareTokenPayload): string {
  const token = signShareToken(payload)
  if (payload.type === 'prediction') {
    const matchId = encodeURIComponent(payload.matchId!.trim())
    const qs = new URLSearchParams({
      userId: payload.userId.trim(),
      poolId: payload.poolId.trim(),
      t: token,
    })
    return `/api/share/prediction/${matchId}?${qs.toString()}`
  }
  const poolId = encodeURIComponent(payload.poolId.trim())
  const qs = new URLSearchParams({
    userId: payload.userId.trim(),
    t: token,
  })
  return `/api/share/leaderboard/${poolId}?${qs.toString()}`
}
