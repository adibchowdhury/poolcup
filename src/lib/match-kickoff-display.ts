const DATE_LOCALE = 'en-US'

/** Local kickoff label — same shape as matches/upcoming tabs (date · time). */
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
  return `${datePart} · ${timePart}`
}

export function formatKickoffCompactOrNull(
  iso: string | null | undefined,
): string | null {
  if (iso == null || iso.trim() === '') return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return formatKickoffCompact(iso)
}
