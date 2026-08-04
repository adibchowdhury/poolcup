'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { poolThemeCssVariables } from '@/src/lib/pool-theme'

type PoolThemeScopeProps = {
  themeColor: string | null | undefined
  children: ReactNode
  className?: string
}

/**
 * Scopes pool accent CSS variables to descendants only — does not mutate
 * global :root, so dashboard / other routes keep the default green.
 */
export function PoolThemeScope({
  themeColor,
  children,
  className,
}: PoolThemeScopeProps) {
  return (
    <div
      data-pool-theme-scope
      className={cn('min-h-0', className)}
      style={poolThemeCssVariables(themeColor)}
    >
      {children}
    </div>
  )
}
