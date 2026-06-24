import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DashboardPlainCardProps = {
  children: ReactNode
  className?: string
}

/** Plain dashboard section card — matches pool cards and chat inbox rows. */
export function DashboardPlainCard({
  children,
  className,
}: DashboardPlainCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/90 bg-card/90 p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}
