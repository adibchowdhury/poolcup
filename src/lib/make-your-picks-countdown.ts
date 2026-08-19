import type { MakeYourPicksMatch } from '@/src/lib/fetch-make-your-picks-queue'

/** Picks locking within this window count as "due soon" in the section subline. */
export const PICKS_DUE_SOON_WINDOW_MS = 6 * 60 * 60 * 1000

/** Below this threshold, countdown + row use urgent (yellow) styling. */
export const PICKS_LOCKING_URGENT_WINDOW_MS = 60 * 60 * 1000

export type PickLockCountdownTier = 'muted' | 'default' | 'urgent'

export function getPickLockCountdownTier(remainingMs: number): PickLockCountdownTier {
  if (remainingMs <= PICKS_LOCKING_URGENT_WINDOW_MS) return 'urgent'
  if (remainingMs <= PICKS_DUE_SOON_WINDOW_MS) return 'default'
  return 'muted'
}

function isTomorrow(lockMs: number, nowMs: number): boolean {
  const lock = new Date(lockMs)
  const tomorrow = new Date(nowMs)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return (
    lock.getFullYear() === tomorrow.getFullYear() &&
    lock.getMonth() === tomorrow.getMonth() &&
    lock.getDate() === tomorrow.getDate()
  )
}

export function formatPickLockCountdownLabel(
  lockAtIso: string,
  nowMs: number,
): { label: string; tier: PickLockCountdownTier } | null {
  const lockMs = new Date(lockAtIso).getTime()
  if (!Number.isFinite(lockMs)) return null

  const remainingMs = lockMs - nowMs
  if (remainingMs <= 0) {
    return { label: 'Locked', tier: 'urgent' }
  }

  const tier = getPickLockCountdownTier(remainingMs)

  if (tier === 'urgent') {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000))
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return {
        label: `🔥 Locks in ${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim(),
        tier,
      }
    }
    return { label: `🔥 Locks in ${totalMinutes}m`, tier }
  }

  if (tier === 'muted') {
    if (isTomorrow(lockMs, nowMs)) {
      const time = new Date(lockMs).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
      return { label: `Tomorrow ${time}`, tier }
    }
    const hours = Math.floor(remainingMs / 3_600_000)
    const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
    return { label: `${hours}h ${minutes}m`, tier }
  }

  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
  if (hours > 0) return { label: `${hours}h ${minutes}m`, tier }
  return { label: `${minutes}m`, tier }
}

export function countUnpickedMatches(
  matches: MakeYourPicksMatch[],
  pickedIds: Set<string>,
): number {
  return matches.filter((match) => !pickedIds.has(match.id)).length
}

export function countDueSoonUnpickedMatches(
  matches: MakeYourPicksMatch[],
  pickedIds: Set<string>,
  nowMs: number,
): number {
  return matches.filter((match) => {
    if (pickedIds.has(match.id)) return false
    const lockAt = match.locked_at ?? match.kickoff_at
    const remainingMs = new Date(lockAt).getTime() - nowMs
    return Number.isFinite(remainingMs) && remainingMs > 0 && remainingMs <= PICKS_DUE_SOON_WINDOW_MS
  }).length
}

function getSoonestUnpickedLockMs(
  matches: MakeYourPicksMatch[],
  pickedIds: Set<string>,
  nowMs: number,
): number | null {
  let soonest: number | null = null

  for (const match of matches) {
    if (pickedIds.has(match.id)) continue
    const lockAt = match.locked_at ?? match.kickoff_at
    const lockMs = new Date(lockAt).getTime()
    if (!Number.isFinite(lockMs)) continue

    const remainingMs = lockMs - nowMs
    if (remainingMs <= 0) continue

    if (soonest === null || lockMs < soonest) soonest = lockMs
  }

  return soonest
}

/** Relative label for the next unpicked lock (header subline, no backlog count). */
export function formatNextLockRelativeLabel(lockMs: number, nowMs: number): string {
  const remainingMs = lockMs - nowMs

  if (isTomorrow(lockMs, nowMs)) {
    const time = new Date(lockMs).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `tomorrow ${time}`
  }

  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)

  if (hours >= 1) {
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`
  }

  return `in ${Math.max(1, minutes)}m`
}

export function formatPicksQueueSubline(
  matches: MakeYourPicksMatch[],
  pickedIds: Set<string>,
  nowMs: number,
): string | null {
  if (countUnpickedMatches(matches, pickedIds) === 0) return null

  const dueSoon = countDueSoonUnpickedMatches(matches, pickedIds, nowMs)
  if (dueSoon > 0) {
    return dueSoon === 1 ? '1 pick due soon' : `${dueSoon} picks due soon`
  }

  const nextLockMs = getSoonestUnpickedLockMs(matches, pickedIds, nowMs)
  if (nextLockMs === null) return null

  return `Next lock: ${formatNextLockRelativeLabel(nextLockMs, nowMs)}`
}
