/** True when predictions are locked (kickoff reached). Mirrors predict page logic. */
export function isMatchLocked(lockedAt: string | null): boolean {
  if (!lockedAt) return false
  return new Date(lockedAt).getTime() <= Date.now()
}

export function isMatchKickedOff(
  lockedAt: string | null,
  kickoffAt: string,
  nowMs: number,
): boolean {
  if (lockedAt) {
    return new Date(lockedAt).getTime() <= nowMs
  }
  return new Date(kickoffAt).getTime() <= nowMs
}
