import type { CSSProperties } from 'react'

/** Default PoolCup primary when pools.theme_color is null. */
export const DEFAULT_POOL_THEME_COLOR = '#00e676'

/** Curated on-brand theme swatches for squad branding. */
export const POOL_THEME_COLOR_PRESETS = [
  { id: 'green', label: 'Electric green', hex: '#00e676' },
  { id: 'blue', label: 'Sky', hex: '#3b82f6' },
  { id: 'cyan', label: 'Cyan', hex: '#22d3ee' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'purple', label: 'Violet', hex: '#a855f7' },
  { id: 'lime', label: 'Lime', hex: '#84cc16' },
] as const

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/

export function isValidPoolThemeHex(value: string | null | undefined): boolean {
  if (!value) return false
  return HEX_COLOR_PATTERN.test(value.trim())
}

/** Normalize to #rrggbb lowercase, or null if invalid / empty. */
export function normalizePoolThemeColor(
  value: string | null | undefined,
): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!isValidPoolThemeHex(withHash)) return null
  return withHash.toLowerCase()
}

/**
 * Effective accent for a pool. Null theme → default green (existing look).
 */
export function resolvePoolThemeColor(
  themeColor: string | null | undefined,
): string {
  return normalizePoolThemeColor(themeColor) ?? DEFAULT_POOL_THEME_COLOR
}

/**
 * Inline CSS variables to scope pool accents without mutating global :root.
 * Apply on a wrapper around pool UI only.
 */
export function poolThemeCssVariables(
  themeColor: string | null | undefined,
): CSSProperties {
  const color = resolvePoolThemeColor(themeColor)
  return {
    ['--primary' as string]: color,
    ['--accent' as string]: color,
    ['--ring' as string]: color,
    ['--chart-1' as string]: color,
    ['--match-live' as string]: color,
  }
}
