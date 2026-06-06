const ENCODED_BYPASS_PATTERN = /%(2f|5c)/i

function failsRedirectChecks(value: string): boolean {
  if (!value.startsWith('/')) return true
  if (value.startsWith('//')) return true
  if (value.includes('://')) return true
  if (value.includes('\\')) return true
  if (ENCODED_BYPASS_PATTERN.test(value)) return true
  return false
}

/**
 * Returns a normalized same-origin path, or null if the value is unsafe.
 * Rejects protocol-relative URLs, absolute URLs, backslash variants, and
 * encoded bypasses like /%2F%2F and /%5C.
 */
export function resolveSafeRedirectPath(
  next: string | null | undefined,
): string | null {
  if (!next) return null

  let current = next

  for (let i = 0; i < 3; i++) {
    if (failsRedirectChecks(current)) return null

    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) break
      current = decoded
    } catch {
      return null
    }
  }

  if (failsRedirectChecks(current)) return null

  return current
}

export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback = '/dashboard',
): string {
  return resolveSafeRedirectPath(next) ?? fallback
}

export function getSafeNext(searchParams: URLSearchParams): string | null {
  return resolveSafeRedirectPath(searchParams.get('next'))
}
