'use client'

import { useTheme } from 'next-themes'
import { useEffect, useId, useState } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUserAccent } from '@/components/user-accent-provider'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  ACCENT_THEME_PRESETS,
  DEFAULT_ACCENT_HEX,
  type AccentThemeKey,
} from '@/src/lib/accent-theme'
import { capturePostHog } from '@/src/lib/posthog-client'

/**
 * Settings: light/dark appearance + accent theme picker.
 */
export function ThemeAppearanceSetting() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const {
    loading: accentLoading,
    accentTheme,
    error,
    saving,
    refresh,
    setAccentTheme,
  } = useUserAccent()
  const groupId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = mounted && resolvedTheme === 'light'

  async function handleSelect(next: AccentThemeKey | null) {
    if (saving) return
    if (next === accentTheme) return
    const result = await setAccentTheme(next)
    if (result.ok) {
      capturePostHog('accent_theme_selected', {
        accent_theme: next ?? 'default',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="settings-theme-light" className="text-sm font-medium">
            Light mode
          </Label>
          <p className="text-xs text-muted-foreground">
            Switch between dark (default) and light appearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Switch
            id="settings-theme-light"
            checked={isLight}
            disabled={!mounted}
            onCheckedChange={(checked) => setTheme(checked ? 'light' : 'dark')}
            aria-label="Toggle light mode"
          />
          <Sun className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-muted/30 px-4 py-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">App accent</p>
            <p className="text-xs text-muted-foreground">
              Choose an accent color used across the app. Pool branding still
              wins inside each pool.
            </p>
          </div>
        </div>


        {accentLoading ? (
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            Loading accent options…
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="App accent color"
            aria-disabled={saving}
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            <AccentSwatch
              groupId={groupId}
              name="Default"
              hex={DEFAULT_ACCENT_HEX}
              selected={accentTheme === null}
              disabled={saving}
              onSelect={() => void handleSelect(null)}
            />
            {ACCENT_THEME_PRESETS.map((preset) => (
              <AccentSwatch
                key={preset.key}
                groupId={groupId}
                name={preset.label}
                hex={preset.hex}
                selected={accentTheme === preset.key}
                disabled={saving}
                onSelect={() => void handleSelect(preset.key)}
              />
            ))}
          </div>
        )}

        {error ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="alert">
            <p className="text-xs text-destructive">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn('h-7', FOCUS_VISIBLE_RING)}
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AccentSwatch({
  groupId,
  name,
  hex,
  selected,
  disabled,
  onSelect,
}: {
  groupId: string
  name: string
  hex: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const id = `${groupId}-${name.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <button
      type="button"
      id={id}
      role="radio"
      aria-checked={selected}
      aria-label={`${name} accent${selected ? ', selected' : ''}`}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        FOCUS_VISIBLE_RING,
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-background/50 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10 shadow-inner"
        style={{ backgroundColor: hex }}
        aria-hidden
      >
        {selected ? (
          <Check className="h-4 w-4 text-[#080b0f]" strokeWidth={3} />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{name}</span>
        <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {hex}
        </span>
      </span>
    </button>
  )
}
