import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DASHBOARD_FEED_SURFACE_CLASS_LG } from '@/components/dashboard/feed/dashboard-home-layout'

type DashboardPlainCardProps = {
  children: ReactNode
  className?: string
}

/** Plain dashboard section card — outline on desktop dashboard home. */
export function DashboardPlainCard({
  children,
  className,
}: DashboardPlainCardProps) {
  return (
    <section className={cn(DASHBOARD_FEED_SURFACE_CLASS_LG, 'p-4 sm:p-5', className)}>
      {children}
    </section>
  )
}
