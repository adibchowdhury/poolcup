import type { PointerEventHandler } from 'react'
import { cn } from '@/lib/utils'
import { bindTactilePress } from '@/src/lib/tactile-press'

/** iOS tactile press feedback for landing links/buttons outside shared `<Button>`. */
export const landingTactilePointerDown: PointerEventHandler<
  HTMLAnchorElement | HTMLButtonElement
> = (event) => {
  bindTactilePress(event.currentTarget)
}

/** Green primary CTA — landing #00e676; shared straight-down tactile. */
export const landingTactilePrimaryClass = cn(
  'ui-tactile-btn ui-tactile-btn--primary',
  'border-none',
  'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_72%,#ffffff),var(--primary))]',
  'hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_72%,#ffffff),var(--primary))]',
  'active:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_72%,#ffffff),var(--primary))]',
  'text-[#080b0f]',
)

/** Free / green outline pricing CTA — flat (outline is out of tactile scope). */
export const landingTactileOutlineGreenClass = cn(
  'border border-[#00e676]/40 bg-transparent text-[#00e676]',
  'transition-colors duration-150',
  'hover:bg-[#00e676]/10 hover:text-[#00e676]',
  'active:bg-[#00e676]/10',
)

/** Custom Pool gold pricing CTA — solid action; surface drives shared edge mix. */
export const landingTactileCommissionerClass = cn(
  'ui-tactile-btn',
  '[--tactile-btn-surface:#ffc107]',
  'border border-[rgba(255,193,7,0.45)] bg-[rgba(255,193,7,0.1)] text-[#ffc107]',
  'hover:bg-[rgba(255,193,7,0.1)]',
  'active:bg-[rgba(255,193,7,0.1)]',
)

/** Static white outline — hero/nav Sign in (no tactile motion). */
export const landingSignInOutlineClass = cn(
  'border-2 border-white bg-transparent text-white',
  'transition-colors duration-150',
  'hover:bg-white/10 hover:text-white',
  'active:bg-white/[0.08]',
)
