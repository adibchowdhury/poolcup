'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        href={STRIPE_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => capturePostHog('support_clicked')}
      >
        <Heart className="size-3.5" aria-hidden />
        Support Us
      </a>
    </Button>
  )
}
