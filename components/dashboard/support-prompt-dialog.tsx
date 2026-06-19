'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildStripeDonateUrl } from '@/src/lib/stripe-donate-url'
import { supabase } from '@/src/lib/supabase'
import { trackEvent } from '@/src/lib/track'

const SUPPORT_MESSAGE_PARAGRAPHS = [
  'Keeping PoolCup free and running costs real money, and right now I cover it all myself.',
  'If PoolCup has made your World Cup more fun, please consider a small donation to help keep it alive.',
  'Thank you for being part of the community.',
] as const

type SupportPromptDialogProps = {
  userId: string
  supportPromptLastShownAt: string | null
  predictionsMade: number
}

export function SupportPromptDialog({
  userId,
  supportPromptLastShownAt,
  predictionsMade,
}: SupportPromptDialogProps) {
  const [open, setOpen] = useState(false)
  const markedShownRef = useRef(false)

  const eligible =
    supportPromptLastShownAt == null && predictionsMade >= 1

  useEffect(() => {
    if (!eligible || markedShownRef.current) {
      return
    }

    markedShownRef.current = true
    setOpen(true)

    trackEvent('support_prompt_shown', {
      userId,
      metadata: { banner: 'support_popup' },
    })

    void supabase
      .rpc('update_support_prompt_state', { p_action: 'shown' })
      .then(({ error }) => {
        if (error) {
          console.error('update_support_prompt_state failed:', error)
        }
      })
  }, [eligible, userId])

  function handleSupportClick() {
    trackEvent('support_prompt_clicked', {
      userId,
      metadata: { banner: 'support_popup' },
    })
    setOpen(false)
  }

  if (!eligible) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle className="font-display text-2xl tracking-wide">
            Support PoolCup
          </DialogTitle>
          <DialogDescription className="sr-only">
            One-time message about supporting PoolCup hosting and development
            costs.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4 text-sm leading-relaxed text-foreground">
            {SUPPORT_MESSAGE_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/60 px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            asChild
            className="w-full border-[#4800AE] bg-[#4800AE] text-white hover:border-[#5a10c4] hover:bg-[#5a10c4] sm:w-auto"
          >
            <a
              href={buildStripeDonateUrl(userId)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleSupportClick}
            >
              Support PoolCup
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
