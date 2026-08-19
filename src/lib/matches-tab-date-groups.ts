import type { MatchesTabMatch } from '@/src/lib/fetch-matches-tab'
import { getMatchLifecycleSection } from '@/src/lib/match-lifecycle-section'

/**
 * Matches tab week boundaries: Monday 00:00 through Sunday 23:59:59.999 (local).
 * (Elsewhere in the app, e.g. friends activity, "This Week" is a rolling 7-day window —
 * not used here.)
 */
export const MATCHES_TAB_WEEK_STARTS_ON = 1 as const // 0 = Sunday, 1 = Monday

export type MatchesTabFixedDateGroupId =
  | 'live'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'later_this_month'
  | 'completed'

export type MatchesTabDateGroupId =
  | MatchesTabFixedDateGroupId
  | `month-${string}`

export const MATCHES_TAB_FIXED_DATE_GROUP_ORDER: MatchesTabFixedDateGroupId[] = [
  'live',
  'today',
  'tomorrow',
  'this_week',
  'next_week',
  'later_this_month',
  'completed',
]

export const MATCHES_TAB_FIXED_DATE_GROUP_LABEL: Record<
  MatchesTabFixedDateGroupId,
  string
> = {
  live: 'Live',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This Week',
  next_week: 'Next Week',
  later_this_month: 'Later This Month',
  completed: 'Completed',
}

export type MatchesTabDateGroup = {
  id: MatchesTabDateGroupId
  label: string
  matches: MatchesTabMatch[]
  showLiveDot: boolean
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfLocalDay(date: Date): Date {
  const start = startOfLocalDay(date)
  return new Date(start.getTime() + 86_400_000 - 1)
}

/** Monday 00:00 local for the week containing `date`. */
export function startOfLocalWeek(date: Date): Date {
  const dayStart = startOfLocalDay(date)
  const dayOfWeek = dayStart.getDay()
  const daysSinceMonday = (dayOfWeek + 7 - MATCHES_TAB_WEEK_STARTS_ON) % 7
  const monday = new Date(dayStart)
  monday.setDate(monday.getDate() - daysSinceMonday)
  return monday
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatMatchesTabMonthGroupLabel(
  kickoff: Date,
  now: Date,
): string {
  const month = kickoff.toLocaleDateString('en-US', { month: 'long' })
  if (kickoff.getFullYear() !== now.getFullYear()) {
    return `${month} ${kickoff.getFullYear()}`
  }
  return month
}

export function monthGroupIdFromKickoff(kickoff: Date): `month-${string}` {
  const year = kickoff.getFullYear()
  const month = String(kickoff.getMonth() + 1).padStart(2, '0')
  return `month-${year}-${month}`
}

/** Upcoming kickoff → fixed bucket or `month-YYYY-MM`. */
export function getUpcomingMatchesTabDateGroupId(
  kickoffAt: string,
  nowMs: number = Date.now(),
): MatchesTabDateGroupId {
  const now = new Date(nowMs)
  const kickoff = new Date(kickoffAt)
  const kickoffDay = startOfLocalDay(kickoff)
  const todayStart = startOfLocalDay(now)
  const tomorrowStart = addLocalDays(todayStart, 1)

  if (kickoffDay.getTime() === todayStart.getTime()) {
    return 'today'
  }
  if (kickoffDay.getTime() === tomorrowStart.getTime()) {
    return 'tomorrow'
  }

  const thisWeekStart = startOfLocalWeek(now)
  const thisWeekEnd = endOfLocalDay(addLocalDays(thisWeekStart, 6))
  const nextWeekStart = addLocalDays(thisWeekStart, 7)
  const nextWeekEnd = endOfLocalDay(addLocalDays(nextWeekStart, 6))

  if (
    kickoffDay.getTime() > tomorrowStart.getTime() &&
    kickoffDay.getTime() >= thisWeekStart.getTime() &&
    kickoffDay.getTime() <= thisWeekEnd.getTime()
  ) {
    return 'this_week'
  }

  if (
    kickoffDay.getTime() >= nextWeekStart.getTime() &&
    kickoffDay.getTime() <= nextWeekEnd.getTime()
  ) {
    return 'next_week'
  }

  if (
    kickoff.getFullYear() === now.getFullYear() &&
    kickoff.getMonth() === now.getMonth()
  ) {
    return 'later_this_month'
  }

  return monthGroupIdFromKickoff(kickoff)
}

function sortByKickoffAsc(matches: MatchesTabMatch[]): MatchesTabMatch[] {
  return [...matches].sort(
    (a, b) =>
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  )
}

/**
 * Desktop Matches tab — Live, calendar buckets, then month groups, then Completed.
 * All grouping uses the viewer's local timezone; empty buckets are omitted.
 */
export function buildMatchesTabDateGroups(
  matches: MatchesTabMatch[],
  nowMs: number = Date.now(),
): MatchesTabDateGroup[] {
  const now = new Date(nowMs)
  const buckets = new Map<MatchesTabDateGroupId, MatchesTabMatch[]>()
  const monthMeta = new Map<
    `month-${string}`,
    { sortKey: string; label: string }
  >()

  for (const match of matches) {
    const lifecycle = getMatchLifecycleSection(match, nowMs)
    let groupId: MatchesTabDateGroupId

    if (lifecycle === 'live') {
      groupId = 'live'
    } else if (lifecycle === 'completed') {
      groupId = 'completed'
    } else {
      groupId = getUpcomingMatchesTabDateGroupId(match.kickoff_at, nowMs)
      if (groupId.startsWith('month-')) {
        const monthId = groupId as `month-${string}`
        if (!monthMeta.has(monthId)) {
          const kickoff = new Date(match.kickoff_at)
          monthMeta.set(monthId, {
            sortKey: monthId.slice('month-'.length),
            label: formatMatchesTabMonthGroupLabel(kickoff, now),
          })
        }
      }
    }

    const list = buckets.get(groupId) ?? []
    list.push(match)
    buckets.set(groupId, list)
  }

  const groups: MatchesTabDateGroup[] = []

  for (const id of MATCHES_TAB_FIXED_DATE_GROUP_ORDER) {
    if (id === 'completed') continue
    const items = buckets.get(id)
    if (!items?.length) continue
    groups.push({
      id,
      label: MATCHES_TAB_FIXED_DATE_GROUP_LABEL[id],
      matches: sortByKickoffAsc(items),
      showLiveDot: id === 'live',
    })
  }

  const monthGroups = [...monthMeta.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([id, meta]) => {
      const items = buckets.get(id)
      if (!items?.length) return []
      return [
        {
          id,
          label: meta.label,
          matches: sortByKickoffAsc(items),
          showLiveDot: false,
        } satisfies MatchesTabDateGroup,
      ]
    })

  groups.push(...monthGroups)

  const completed = buckets.get('completed')
  if (completed?.length) {
    groups.push({
      id: 'completed',
      label: MATCHES_TAB_FIXED_DATE_GROUP_LABEL.completed,
      matches: sortByKickoffAsc(completed),
      showLiveDot: false,
    })
  }

  return groups
}
