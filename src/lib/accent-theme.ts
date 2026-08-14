import type { CSSProperties } from 'react'
import { DEFAULT_POOL_THEME_COLOR } from '@/src/lib/pool-theme'

/** Dark text on accent (matches default green buttons). */
export const ACCENT_ON_FOREGROUND = '#080b0f'

export type AccentThemeKey =
  | 'ocean'
  | 'sunset'
  | 'royal'
  | 'crimson'
  | 'slate'

export type AccentThemePreset = {
  key: AccentThemeKey
  label: string
  hex: string
  foreground: typeof ACCENT_ON_FOREGROUND
}

export const ACCENT_THEME_PRESETS: AccentThemePreset[] = [
  {
    key: 'ocean',
    label: 'Ocean',
    hex: '#2196f3',
    foreground: ACCENT_ON_FOREGROUND,
  },
  {
    key: 'sunset',
    label: 'Sunset',
    hex: '#ff9100',
    foreground: ACCENT_ON_FOREGROUND,
  },
  {
    key: 'royal',
    label: 'Royal',
    hex: '#9575ff',
    foreground: ACCENT_ON_FOREGROUND,
  },
  {
    key: 'crimson',
    label: 'Crimson',
    hex: '#ff1744',
    foreground: ACCENT_ON_FOREGROUND,
  },
  {
    key: 'slate',
    label: 'Slate',
    hex: '#78909c',
    foreground: ACCENT_ON_FOREGROUND,
  },
]

const PRESET_BY_KEY = Object.fromEntries(
  ACCENT_THEME_PRESETS.map((p) => [p.key, p]),
) as Record<AccentThemeKey, AccentThemePreset>

export const DEFAULT_ACCENT_HEX = DEFAULT_POOL_THEME_COLOR

export function isAccentThemeKey(value: unknown): value is AccentThemeKey {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PRESET_BY_KEY, value)
  )
}

/** Parse DB/API value: preset key or null (default green). */
export function parseAccentTheme(
  value: unknown,
): AccentThemeKey | null {
  if (value == null || value === '' || value === 'default' || value === 'green') {
    return null
  }
  return isAccentThemeKey(value) ? value : null
}

export function getAccentThemePreset(
  key: AccentThemeKey | null,
): AccentThemePreset | null {
  if (!key) return null
  return PRESET_BY_KEY[key] ?? null
}

export function resolveAccentHex(key: AccentThemeKey | null): string {
  return getAccentThemePreset(key)?.hex ?? DEFAULT_ACCENT_HEX
}

/**
 * Same accent var bundle as poolThemeCssVariables, plus on-accent foregrounds.
 * Apply on documentElement for Pro app-wide theming.
 */
export function accentThemeCssVariables(
  key: AccentThemeKey | null,
): CSSProperties | null {
  const preset = getAccentThemePreset(key)
  if (!preset) return null
  return {
    ['--primary' as string]: preset.hex,
    ['--accent' as string]: preset.hex,
    ['--ring' as string]: preset.hex,
    ['--chart-1' as string]: preset.hex,
    ['--match-live' as string]: preset.hex,
    ['--primary-foreground' as string]: preset.foreground,
    ['--accent-foreground' as string]: preset.foreground,
  }
}

const ACCENT_CSS_VAR_KEYS = [
  '--primary',
  '--accent',
  '--ring',
  '--chart-1',
  '--match-live',
  '--primary-foreground',
  '--accent-foreground',
] as const

/** Apply Pro accent to <html>, or clear overrides (default green from CSS). */
export function applyAccentThemeToDocument(
  key: AccentThemeKey | null,
  isPro: boolean,
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const vars = isPro ? accentThemeCssVariables(key) : null
  if (!vars) {
    for (const name of ACCENT_CSS_VAR_KEYS) {
      root.style.removeProperty(name)
    }
    return
  }
  for (const [name, value] of Object.entries(vars)) {
    if (typeof value === 'string') {
      root.style.setProperty(name, value)
    }
  }
}
