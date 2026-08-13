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

/** Dark text used on accent buttons / chips. */
export const THEME_ON_ACCENT_DARK = '#080b0f'
/** Light text alternative on dark accents. */
export const THEME_ON_ACCENT_LIGHT = '#ffffff'
/** App dark background accents sit on. */
export const THEME_APP_BACKGROUND = '#131313'

/** WCAG AA normal text. */
export const THEME_CONTRAST_MIN = 4.5

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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizePoolThemeColor(hex)
  if (!normalized) return null
  const n = Number.parseInt(normalized.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = channel(rgb.r)
  const g = channel(rgb.g)
  const b = channel(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #rrggbb colors (1–21). */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const l1 = relativeLuminance(hexA)
  const l2 = relativeLuminance(hexB)
  if (l1 == null || l2 == null) return null
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export type ThemeContrastReport = {
  ok: boolean
  ratioVsDarkText: number | null
  ratioVsLightText: number | null
  ratioAsTextOnBg: number | null
  preferredOnAccent: 'dark' | 'light'
  warning: string | null
}

/**
 * Practical check: accent must support readable text on it (dark or white),
 * and remain visible as an accent on the dark app background.
 */
export function evaluateThemeContrast(
  themeColor: string | null | undefined,
): ThemeContrastReport {
  const color = resolvePoolThemeColor(themeColor)
  const vsDark = contrastRatio(color, THEME_ON_ACCENT_DARK)
  const vsLight = contrastRatio(color, THEME_ON_ACCENT_LIGHT)
  const asText = contrastRatio(color, THEME_APP_BACKGROUND)
  const preferredOnAccent: 'dark' | 'light' =
    (vsDark ?? 0) >= (vsLight ?? 0) ? 'dark' : 'light'
  const bestOnAccent = Math.max(vsDark ?? 0, vsLight ?? 0)
  const onAccentOk = bestOnAccent >= THEME_CONTRAST_MIN
  const asTextOk = (asText ?? 0) >= 3 // large-text / UI accent threshold
  const ok = onAccentOk && asTextOk
  const warning = ok
    ? null
    : 'This color may make text hard to read. Prefer a brighter or darker accent.'

  return {
    ok,
    ratioVsDarkText: vsDark,
    ratioVsLightText: vsLight,
    ratioAsTextOnBg: asText,
    preferredOnAccent,
    warning,
  }
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
