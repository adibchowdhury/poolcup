import { cn } from '@/lib/utils'

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-md pool-card-shimmer', className)}
      aria-hidden
    />
  )
}
