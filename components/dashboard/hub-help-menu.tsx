'use client'

import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

export type HubHelpMenuItem = {
  label: string
  href: string
  external?: boolean
}

/** Help dropdown entries — append items here as support options grow. */
export const HUB_HELP_MENU_ITEMS: HubHelpMenuItem[] = [
  {
    label: 'Contact us',
    href: '/contact',
  },
]

export function HubHelpMenu({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full',
            'border border-white/[0.08] text-muted-foreground transition-colors',
            'hover:bg-white/[0.06] hover:text-foreground',
            FOCUS_VISIBLE_RING,
            className,
          )}
          aria-label="Help"
          aria-haspopup="menu"
        >
          <CircleHelp className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[10rem]">
        {HUB_HELP_MENU_ITEMS.map((item) =>
          item.external ? (
            <DropdownMenuItem key={item.href} asChild>
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
