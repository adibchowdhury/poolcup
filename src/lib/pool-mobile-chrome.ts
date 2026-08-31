import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

/**
 * Mobile pool content horizontal inset — Home + Predictions + invite banner.
 * Was edge-pressed (px-0); now 16px each side.
 */
export const POOL_MOBILE_CONTENT_PAD_CLASS = 'max-lg:px-4'

/**
 * Mobile tab triggers — text-only.
 * Active: white label (underline is a separate sliding indicator).
 * Inactive: muted grey text.
 */
export const POOL_MOBILE_TAB_TRIGGER_CLASS = cn(
  'relative z-[1] h-auto flex-1 rounded-none border-0 bg-transparent',
  'px-1 py-2.5 text-sm font-medium leading-none shadow-none',
  'text-muted-foreground transition-colors',
  'data-[state=active]:bg-transparent data-[state=active]:text-white',
  'data-[state=active]:shadow-none',
  'dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white',
  FOCUS_VISIBLE_RING,
)

export const POOL_MOBILE_TAB_LIST_CLASS = cn(
  'relative grid h-auto w-full grid-cols-3 gap-0 rounded-none bg-transparent p-0',
  'border-b border-border/60',
)

/** Sliding green underline — width 1/3, translateX by tab index. */
export const POOL_MOBILE_TAB_INDICATOR_CLASS = cn(
  'pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/3 bg-primary',
  'will-change-transform',
)

/**
 * Pool overflow ⋮ menu — replaces default `bg-popover` (#111a27 navy “blue block”).
 * Charcoal dashboard card family: #171717 + #292929 border + soft shadow.
 * z-[120] floats above sticky pool header (z-[100]) without layout shift.
 */
export const POOL_OVERFLOW_MENU_CONTENT_CLASS = cn(
  'relative z-[120] w-[11.75rem] !overflow-visible rounded-xl border border-[#292929]',
  'bg-[#171717] p-1.5 text-white shadow-[0_10px_32px_rgba(0,0,0,0.55)]',
)

/** Row: white label, muted grey icons; hover = white/8 (no accent/blue). */
export const POOL_OVERFLOW_MENU_ITEM_CLASS = cn(
  'cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white outline-none',
  '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-[#8a9aa8]',
  'focus:bg-white/[0.08] focus:text-white data-[highlighted]:bg-white/[0.08]',
  'data-[highlighted]:text-white',
  'active:bg-white/[0.12]',
)

/** Leave pool — destructive red text + icon; dark-red press, still no blue. */
export const POOL_OVERFLOW_MENU_ITEM_DESTRUCTIVE_CLASS = cn(
  POOL_OVERFLOW_MENU_ITEM_CLASS,
  'text-destructive focus:bg-destructive/15 focus:text-destructive',
  'data-[highlighted]:bg-destructive/15 data-[highlighted]:text-destructive',
  '[&_svg]:!text-destructive',
)
