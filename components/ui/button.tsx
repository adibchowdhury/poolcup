import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { bindTactilePress } from '@/src/lib/tactile-press'

/**
 * Shared Button — tactile depth via `.ui-tactile-btn` for solid CTA variants.
 *
 * Edge color derives from `--tactile-btn-surface` (NOT from the painted background):
 *   color-mix(in srgb, var(--tactile-btn-surface) 70%, #000)
 *
 * Rule: custom bg = set --tactile-btn-surface (inline style or `[--tactile-btn-surface:…]`).
 * Prefer `variant="destructive" | "secondary" | "default"` over painting bg-* on a
 * mismatched variant — bg utilities override fill but leave the edge on the wrong surface.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        /** Solid CTA — straight-down tactile depth via `.ui-tactile-btn`. */
        default: 'ui-tactile-btn ui-tactile-btn--primary text-primary-foreground',
        destructive:
          'ui-tactile-btn ui-tactile-btn--destructive text-white focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        /** Flat — no depth (cancel / secondary chrome). */
        outline:
          'border bg-background shadow-none dark:bg-input/30 dark:border-input hover:bg-accent hover:text-accent-foreground dark:hover:bg-input/50',
        secondary:
          'ui-tactile-btn ui-tactile-btn--secondary text-secondary-foreground',
        /** Flat — no depth. */
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline transition-colors',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  onPointerDown,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const isIcon = size === 'icon' || size === 'icon-sm' || size === 'icon-lg'
  const isTactileVariant =
    variant !== 'link' && variant !== 'outline' && variant !== 'ghost'
  const isTactile = isTactileVariant && !isIcon

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        isIcon && isTactileVariant && 'ui-tactile-btn--flat',
      )}
      onPointerDown={(event) => {
        if (isTactile) bindTactilePress(event.currentTarget)
        onPointerDown?.(event)
      }}
      {...props}
    />
  )
}

export { Button, buttonVariants }
