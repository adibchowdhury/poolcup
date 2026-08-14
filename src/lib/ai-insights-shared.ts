export const INSIGHT_TYPES = [
  'weekly_summary',
  'strongest_sport',
  'weakest_area',
  'recent_form',
] as const

export type InsightType = (typeof INSIGHT_TYPES)[number]

export type InsightItem = {
  type: InsightType
  title: string
  body: string
}

export type InsightFeedback = 'useful' | 'not_useful'

export function formatGeneratedAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'just now'
  const diffSec = Math.max(0, Math.floor((now - t) / 1000))
  if (diffSec < 60) return 'just now'
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
