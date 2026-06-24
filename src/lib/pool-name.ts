/** Matches pool creation: trim before save; non-empty after trim. */
export function normalizePoolName(name: string): string {
  return name.trim()
}

export function validatePoolName(name: string): string | null {
  const trimmed = normalizePoolName(name)
  if (!trimmed) {
    return 'Pool name is required'
  }
  return null
}

export function isPoolNameUnchanged(currentName: string, draftName: string): boolean {
  return normalizePoolName(draftName) === normalizePoolName(currentName)
}
