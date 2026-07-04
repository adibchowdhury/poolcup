/** Extract invite code from raw input or a pasted /join/{code} URL (website path). */
export function parseInviteCodeInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (trimmed.includes('://') || /^www\./i.test(trimmed)) {
    try {
      const url = trimmed.includes('://') ? trimmed : `https://${trimmed}`
      const pathname = new URL(url).pathname
      const match = pathname.match(/\/join\/([^/?#]+)/i)
      if (match?.[1]) {
        return decodeURIComponent(match[1].trim())
      }
    } catch {
      // fall through to path / raw handling
    }
  }

  const pathMatch = trimmed.match(/\/join\/([^/?#]+)/i)
  if (pathMatch?.[1]) {
    return pathMatch[1].trim()
  }

  return trimmed
}
