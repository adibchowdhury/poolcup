'use client'

import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaveBarProps {
  unsavedCount: number
  saving: boolean
  success: boolean
  disabled: boolean
  onSave: () => void
  /** When true and there are no unsaved changes, show a persistent "done" state. */
  complete?: boolean
}

export function SaveBar({
  unsavedCount,
  saving,
  success,
  disabled,
  onSave,
  complete = false,
}: SaveBarProps) {
  const hasChanges = unsavedCount > 0
  const showComplete = complete && !hasChanges && !saving && !success

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md safe-area-pb">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <span
          className={cn(
            'font-mono text-xs transition-opacity duration-200 sm:text-sm',
            hasChanges ? 'text-secondary opacity-100' : 'opacity-0',
          )}
        >
          {unsavedCount} unsaved {unsavedCount === 1 ? 'change' : 'changes'}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:text-base',
            (success || showComplete) &&
              'bg-primary text-primary-foreground shadow-[0_0_24px_rgba(0,230,118,0.45)]',
            !success &&
              !showComplete &&
              hasChanges &&
              !saving &&
              'bg-primary text-primary-foreground shadow-[0_4px_24px_rgba(0,230,118,0.35)] hover:bg-primary/90 hover:shadow-[0_6px_28px_rgba(0,230,118,0.45)]',
            !success &&
              !showComplete &&
              (!hasChanges || saving) &&
              'cursor-not-allowed bg-muted text-muted-foreground shadow-none',
          )}
        >
          {saving ? (
            <span>Saving…</span>
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
