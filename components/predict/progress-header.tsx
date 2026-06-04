'use client'

import { cn } from '@/lib/utils'

interface ProgressHeaderProps {
  current: number
  total: number
  label?: string
  className?: string
}

export function ProgressHeader({
  current,
  total,
  label = 'Matches Predicted',
  className,
}: ProgressHeaderProps) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-foreground">
        <span className="font-mono text-primary">{current}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-mono text-foreground">{total}</span>
        <span className="text-muted-foreground"> {label}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out shadow-[0_0_12px_rgba(0,230,118,0.4)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
