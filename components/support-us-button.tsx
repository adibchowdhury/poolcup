'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { capturePostHog } from '@/src/lib/posthog-client'

const STRIPE_DONATE_URL =
  'https://donate.stripe.com/aFa9ASayG42Q9P5g1K4ZG00'

type SupportUsButtonProps = {
  className?: string
  fullWidth?: boolean
}

export function SupportUsButton({
  className,
  fullWidth,
}: SupportUsButtonProps) {
  return (
    <a
      href={STRIPE_DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => capturePostHog('support_clicked')}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#4800AE] bg-[#4800AE] px-3 py-2 text-sm font-medium text-white transition-all hover:bg-[#5a10c4] hover:border-[#5a10c4] active:scale-95',
        fullWidth && 'w-full',
        className,
      )}
    >
      <Heart className="h-3.5 w-3.5" aria-hidden />
      Support Us
    </a>
  )
}
