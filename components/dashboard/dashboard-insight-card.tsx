import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DASHBOARD_INSIGHT_CARD_SURFACE_CLASS =
  'rounded-2xl border border-white/[0.09] bg-transparent p-4 sm:p-5'

type DashboardInsightCardProps = {
  children: ReactNode
  className?: string
}

/** Transparent hairline outline — insight cards only (Today's Matches, etc.). */
export function DashboardInsightCard({
  children,
  className,
}: DashboardInsightCardProps) {
  return (
    <section
      className={cn(DASHBOARD_INSIGHT_CARD_SURFACE_CLASS, className)}
    >
      {children}
    </section>
  )
}
