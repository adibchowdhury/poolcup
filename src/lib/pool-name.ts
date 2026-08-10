/** Matches pool creation: trim before save; non-empty after trim. */
export function normalizePoolName(name: string): string {
  return name.trim()
}

export const POOL_NAME_MIN_LENGTH = 2
export const POOL_NAME_MAX_LENGTH = 50
export const POOL_DESCRIPTION_MAX_LENGTH = 280

export function normalizePoolDescription(description: string): string {
  return description.trim()
}

/**
 * Returns an error message, or null when valid.
 * Create + rename share these bounds.
 */
export function validatePoolName(name: string): string | null {
  const trimmed = normalizePoolName(name)
  if (!trimmed) {
    return 'Pool name is required'
  }
  if (trimmed.length < POOL_NAME_MIN_LENGTH) {
    return `Pool name must be at least ${POOL_NAME_MIN_LENGTH} characters`
  }
  if (trimmed.length > POOL_NAME_MAX_LENGTH) {
    return `Pool name must be ${POOL_NAME_MAX_LENGTH} characters or fewer`
  }
  return null
}

/** Optional field — empty is valid; over-max is not. */
export function validatePoolDescription(description: string): string | null {
  const trimmed = normalizePoolDescription(description)
  if (trimmed.length > POOL_DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${POOL_DESCRIPTION_MAX_LENGTH} characters or fewer`
  }
  return null
}

export function isPoolNameUnchanged(currentName: string, draftName: string): boolean {
  return normalizePoolName(draftName) === normalizePoolName(currentName)
}
