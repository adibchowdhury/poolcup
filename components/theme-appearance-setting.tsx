'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Settings row: light / dark appearance via next-themes (localStorage).
 * Default app theme is dark; toggle on = light.
 */
export function ThemeAppearanceSetting() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = mounted && resolvedTheme === 'light'

  return (
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
  )
}
