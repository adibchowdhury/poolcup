import type { UpcomingMatch } from './fetch-upcoming-matches'

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd Place Playoff',
  final: 'Final',
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000
const DATE_LOCALE = 'en-US'

export function formatRoundLabel(round: string, groupName: string | null): string {
  if (round === 'group' && groupName) {
    return `Group ${groupName}`
  }
  return ROUND_LABELS[round] ?? round
}

export function formatGroupAccentLabel(
  round: string,
  groupName: string | null,
): string {
  if (round === 'group' && groupName) {
    return `GROUP ${groupName.toUpperCase()}`
  }
  return formatRoundLabel(round, groupName).toUpperCase()
}

export function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatKickoffCompact(iso: string): string {
  const kickoff = new Date(iso)
  const datePart = kickoff.toLocaleDateString(DATE_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timePart = kickoff.toLocaleTimeString(DATE_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} – ${timePart}`
}

export function getCountdownLabel(
  kickoffAt: string,
  nowMs: number,
): string | null {
  const ms = new Date(kickoffAt).getTime() - nowMs
  if (ms <= 0 || ms > FORTY_EIGHT_HOURS_MS) return null

  const totalHours = Math.max(1, Math.ceil(ms / (60 * 60 * 1000)))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`
  }
  return `Starts in ${hours}h`
}

export function groupMatchesByDay(
  matches: UpcomingMatch[],
): Map<string, UpcomingMatch[]> {
  const byDay = new Map<string, UpcomingMatch[]>()
  for (const match of matches) {
    const dayKey = new Date(match.kickoff_at).toDateString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(match)
  }
  return byDay
}

export function groupScheduleItemsByDay<T extends { kickoff_at: string }>(
  items: T[],
): Map<string, T[]> {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  )
  const byDay = new Map<string, T[]>()
  for (const item of sorted) {
    const dayKey = new Date(item.kickoff_at).toDateString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(item)
  }
  return byDay
}
