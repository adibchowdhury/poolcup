'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { capturePostHog } from '@/src/lib/posthog-client'
import { useAuth } from '@/src/lib/auth-context'
import {
  buildStripeDonateUrl,
  STRIPE_DONATE_BASE_URL,
} from '@/src/lib/stripe-donate-url'

/** @deprecated Use STRIPE_DONATE_BASE_URL or buildStripeDonateUrl() */
export const STRIPE_DONATE_URL = STRIPE_DONATE_BASE_URL

type SupportUsButtonProps = {
  className?: string
  fullWidth?: boolean
  onNavigate?: () => void
}

export function SupportUsButton({
  className,
  fullWidth,
  onNavigate,
}: SupportUsButtonProps) {
  const { user } = useAuth()
  const donateHref = buildStripeDonateUrl(user?.id)

  return (
    <Button
      asChild
      size="sm"
      className={cn(
        'border-[#4800AE] bg-[#4800AE] text-white hover:border-[#5a10c4] hover:bg-[#5a10c4] active:scale-95',
        fullWidth && 'w-full',
        className,
      )}
    >
      <a
        href={donateHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          capturePostHog('support_clicked')
          onNavigate?.()
        }}
      >
        <Heart className="size-3.5" aria-hidden />
        Support Us
      </a>
    </Button>
  )
}
