'use client'

import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SAVE_BAR_ABOVE_MOBILE_NAV_BOTTOM_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

interface SaveBarProps {
  unsavedCount: number
  saving: boolean
  success: boolean
  disabled: boolean
  onSave: () => void
  /** When true and there are no unsaved changes, show a persistent "done" state. */
  complete?: boolean
  error?: string | null
  /**
   * On mobile, offset above the fixed bottom nav (pool predictions tab).
   * Set false on /predict where the nav is hidden.
   */
  stackAboveMobileNav?: boolean
}

export function SaveBar({
  unsavedCount,
  saving,
  success,
  disabled,
  onSave,
  complete = false,
  error = null,
  stackAboveMobileNav = true,
}: SaveBarProps) {
  const hasChanges = unsavedCount > 0
  const showComplete = complete && !hasChanges && !saving && !success && !error
  const canRetry = Boolean(error) && !saving

  return (
    <div
      className={cn(
        'fixed left-0 right-0 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md',
        stackAboveMobileNav
          ? cn(
              SAVE_BAR_ABOVE_MOBILE_NAV_BOTTOM_CLASS,
              'max-sm:z-[60] max-sm:pb-3',
              'sm:bottom-0 sm:z-30 sm:safe-area-pb',
            )
          : 'bottom-0 z-30 safe-area-pb',
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <span
          className={cn(
            'font-mono text-xs transition-opacity duration-200 sm:text-sm',
            error
              ? 'text-destructive opacity-100'
              : hasChanges
                ? 'text-secondary opacity-100'
                : 'opacity-0',
          )}
        >
          {error
            ? error
            : hasChanges
              ? `${unsavedCount} unsaved ${unsavedCount === 1 ? 'change' : 'changes'}`
              : ''}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={canRetry ? false : disabled || saving}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:text-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            (success || showComplete) &&
              'bg-primary text-primary-foreground shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_45%,transparent)]',
            canRetry &&
              'bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90',
            !success &&
              !showComplete &&
              !canRetry &&
              hasChanges &&
              !saving &&
              'bg-primary text-primary-foreground shadow-[0_4px_24px_color-mix(in_srgb,var(--primary)_35%,transparent)] hover:bg-primary/90 hover:shadow-[0_6px_28px_color-mix(in_srgb,var(--primary)_45%,transparent)]',
            !success &&
              !showComplete &&
              !canRetry &&
              (!hasChanges || saving) &&
              'cursor-not-allowed bg-muted text-muted-foreground shadow-none',
          )}
        >
          {saving ? (
            <span>Saving…</span>
          ) : canRetry ? (
            <span>Try again</span>
          ) : success ? (
            <>
              <Check className="h-4 w-4" />
              <span>Saved</span>
            </>
          ) : showComplete ? (
            <>
              <Check className="h-4 w-4" />
              <span>All done</span>
            </>
          ) : (
            <>
              <span>Save predictions</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
