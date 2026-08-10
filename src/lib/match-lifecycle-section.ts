import { isFinalStatus } from '@/src/lib/api-football'
import { FEATURED_LIVE_STATUS_SHORTS } from '@/src/lib/featured-match'
import {
  isVoidMatchStatus,
  normalizeMatchStatusShort,
} from '@/src/lib/match-void-status'

export type MatchLifecycleSectionId = 'live' | 'upcoming' | 'completed'

export const MATCH_LIFECYCLE_SECTION_ORDER: MatchLifecycleSectionId[] = [
  'live',
  'upcoming',
  'completed',
]

export const MATCH_LIFECYCLE_SECTION_LABEL: Record<
  MatchLifecycleSectionId,
  string
> = {
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Completed',
}

const LIVE_STATUS_SET = new Set<string>(FEATURED_LIVE_STATUS_SHORTS)

export function isLiveMatchStatus(
  statusShort: string | null | undefined,
): boolean {
  return LIVE_STATUS_SET.has(normalizeMatchStatusShort(statusShort))
}

/**
 * Bucket a match into Live / Upcoming / Completed for list UIs.
 * Void statuses (PST/CANC/ABD/AWD/WO) land in Completed — they are not scored.
 */
export function getMatchLifecycleSection(
  match: {
    statusShort?: string | null
    status_short?: string | null
    isFinal?: boolean
    is_final?: boolean
    kickoffAt?: string
    kickoff_at?: string
  },
  nowMs: number = Date.now(),
): MatchLifecycleSectionId {
  const statusShort = match.statusShort ?? match.status_short ?? null
  const isFinal = Boolean(match.isFinal ?? match.is_final)
  const kickoffAt = match.kickoffAt ?? match.kickoff_at ?? ''

  if (isVoidMatchStatus(statusShort)) return 'completed'
  if (isFinal || isFinalStatus(statusShort ?? '')) return 'completed'
  if (isLiveMatchStatus(statusShort)) return 'live'

  const kickoffMs = new Date(kickoffAt).getTime()
  if (!Number.isNaN(kickoffMs) && kickoffMs <= nowMs) {
    // Past kickoff without live/final/void status — treat as live clock gap
    // only when locked mid-match isn't represented; default upcoming→completed
    // by kickoff would mislabel NS after kickoff. Prefer upcoming until final.
    return 'upcoming'
  }

  return 'upcoming'
}

export function partitionByLifecycleSection<T>(
  items: T[],
  getSection: (item: T) => MatchLifecycleSectionId,
): Record<MatchLifecycleSectionId, T[]> {
  const buckets: Record<MatchLifecycleSectionId, T[]> = {
    live: [],
    upcoming: [],
    completed: [],
  }

  for (const item of items) {
    buckets[getSection(item)].push(item)
  }

  return buckets
}
