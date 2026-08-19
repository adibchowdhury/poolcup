import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_HOME_PANEL_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS_LG,
} from '@/src/lib/dashboard-surfaces'

export {
  DASHBOARD_HOME_PANEL_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS_LG,
} from '@/src/lib/dashboard-surfaces'

type DashboardHomePanelProps = {
  children: ReactNode
  className?: string
  /** Stable id for analytics / scroll targets. */
  id?: string
}

export function DashboardHomePanel({
  children,
  className,
  id,
}: DashboardHomePanelProps) {
  return (
    <div id={id} className={cn(DASHBOARD_HOME_PANEL_CLASS, className)}>
      {children}
    </div>
  )
}

/** ~68% main / ~32% rail at lg+; mobile stacks via parent grid. */
export const DASHBOARD_HOME_DESKTOP_GRID_CLASS = cn(
  'hidden min-w-0 lg:grid lg:items-start lg:gap-5 xl:gap-6',
  'lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,32%)]',
)

export const DASHBOARD_HOME_RAIL_STACK_CLASS = 'flex min-w-0 flex-col gap-6'

/** Left column stack of per-section panels on desktop. */
export const DASHBOARD_HOME_MAIN_SECTIONS_CLASS = 'flex min-w-0 flex-col gap-5'

export const DASHBOARD_HOME_DESKTOP_STACK_CLASS = 'hidden min-w-0 space-y-5 lg:block'
