'use client'

import { ArrowLeft } from 'lucide-react'
import {
  MOBILE_OVERLAY_PAGE_TITLES,
  type MobileOverlayPageId,
} from '../lib/mobile-overlay-pages'

type MobileOverlayPlaceholderPageProps = {
  pageId: MobileOverlayPageId
  onBack: () => void
}

export function MobileOverlayPlaceholderPage({
  pageId,
  onBack,
}: MobileOverlayPlaceholderPageProps) {
  const title = MOBILE_OVERLAY_PAGE_TITLES[pageId]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/80 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="font-display text-xl tracking-wide text-foreground">
          {title}
        </h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="font-display text-2xl tracking-wide text-foreground">
          Coming soon
        </p>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          {title} will be available in a future update. Thanks for your
          patience.
        </p>
      </div>
    </div>
  )
}
