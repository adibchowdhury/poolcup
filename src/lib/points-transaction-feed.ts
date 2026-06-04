export type PointsTransactionReason =
  | 'signup'
  | 'referral'
  | 'correct_winner'
  | 'exact_score'
  | 'pool_created'

export type PointsTransactionRow = {
  id: string
  reason: string
  points: number
  created_at: string
}

const REASON_DESCRIPTIONS: Record<PointsTransactionReason, string> = {
  signup: 'Joined PoolCup',
  referral: 'Friend joined your pool',
  correct_winner: 'Correct winner prediction',
  exact_score: 'Exact score prediction',
  pool_created: 'Created a pool',
}

export function getPointsTransactionDescription(reason: string): string {
  const description = REASON_DESCRIPTIONS[reason as PointsTransactionReason]
  if (description) return description
  return reason.replace(/_/g, ' ')
}

export function formatPointsDelta(points: number): string {
  const sign = points >= 0 ? '+' : ''
  return `${sign}${points} pts`
}

export function formatRelativeTimestamp(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 45) return 'just now'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`
  }

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) {
    return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
  }

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`
  }

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) {
    return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`
  }

  const diffYear = Math.floor(diffMonth / 12)
  return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`
}

/** Stagger delay per row; total motion aligns with 1s count-up on profile. */
export const POINTS_FEED_STAGGER_MS = 80
export const POINTS_FEED_ANIMATION_MS = 1000
