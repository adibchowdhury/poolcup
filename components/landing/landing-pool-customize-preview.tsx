'use client'

import { Check, Megaphone, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  POOL_THEME_COLOR_PRESETS,
  poolThemeCssVariables,
  resolvePoolThemeColor,
} from '@/src/lib/pool-theme'

/**
 * Landing-only presentational slice of Pool Settings customization.
 * Static example data — no auth, fetch, save, or live controls.
 * Mirrors pool name display + glossy theme chips from pool-settings-tab.
 */

const EXAMPLE = {
  poolName: 'Office Legends',
  /** Amber — a clear non-default pick so customization reads visually. */
  themeColor: '#f59e0b',
  scoring: {
    exact: 5,
    winner: 3,
    draw: 2,
  },
  announcement: 'Finals week — predictions lock 1 hour before kickoff.',
} as const

type LandingPoolCustomizePreviewProps = {
  /** Nest inside a feature card — drop outer chrome (parent provides glass frame). */
  embedded?: boolean
}

function PreviewSectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="shrink-0 font-display text-base tracking-wide text-foreground sm:text-lg">
        {title}
      </h3>
      <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  )
}

export function LandingPoolCustomizePreview({
  embedded = false,
}: LandingPoolCustomizePreviewProps) {
  const theme = resolvePoolThemeColor(EXAMPLE.themeColor)

  return (
    <div
      className={cn(
        'overflow-hidden bg-app-background',
        !embedded &&
          'rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
      )}
      style={poolThemeCssVariables(EXAMPLE.themeColor)}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-md space-y-5 px-3.5 py-4 sm:space-y-6 sm:px-5 sm:py-5">
        {/* Pool identity */}
        <section>
          <PreviewSectionHeading title="Pool name" />
          <div className="flex items-center gap-1.5">
            <p
              className="font-display text-2xl tracking-wide sm:text-3xl"
              style={{ color: theme }}
            >
              {EXAMPLE.poolName}
            </p>
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
              aria-hidden
            >
              <Pencil className="h-4 w-4" />
            </span>
          </div>
        </section>

        {/* Color chips — mirrors pool-settings-tab glossy presets */}
        <section>
          <PreviewSectionHeading title="Pool color" />
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-white/25 shadow-[0_0_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
              style={{
                background: `linear-gradient(160deg, ${theme} 0%, color-mix(in srgb, ${theme} 50%, #0a0a0a) 100%)`,
              }}
            >
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"
                aria-hidden
              />
            </div>
            <p className="min-w-0 flex-1 font-mono text-sm text-muted-foreground">
              {theme}
            </p>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2.5">
            {POOL_THEME_COLOR_PRESETS.map((preset) => {
              const selected = preset.hex === EXAMPLE.themeColor
              return (
                <div
                  key={preset.id}
                  className={cn(
                    'relative h-11 w-11 overflow-hidden rounded-xl border-2',
                    selected
                      ? 'scale-[1.08] border-white shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_50%,transparent)]'
                      : 'border-white/20',
                  )}
                  style={{
                    background: `linear-gradient(160deg, ${preset.hex} 0%, color-mix(in srgb, ${preset.hex} 50%, #0a0a0a) 100%)`,
                  }}
                  title={preset.label}
                >
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"
                    aria-hidden
                  />
                  {selected ? (
                    <Check
                      className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                      aria-hidden
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* Compact scoring + announcement — secondary signals */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5">
          <section className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Scoring rules
            </p>
            <ul className="mt-1.5 space-y-1 text-xs">
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">Exact</span>
                <span className="font-mono tabular-nums text-primary">
                  {EXAMPLE.scoring.exact} pts
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">Winner</span>
                <span className="font-mono tabular-nums text-primary">
                  {EXAMPLE.scoring.winner} pts
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">Draw</span>
                <span className="font-mono tabular-nums text-primary">
                  {EXAMPLE.scoring.draw} pts
                </span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Announcement
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-snug text-foreground/90">
              {EXAMPLE.announcement}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
