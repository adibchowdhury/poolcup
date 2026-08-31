import { POOL_DESKTOP_CONTENT_RAIL_CLASS } from '@/components/pool/pool-desktop-top-bar'
import {
  PoolHomeTab,
  type PoolHomeTabProps,
} from '@/components/pool/pool-home-tab'
import { cn } from '@/lib/utils'

export type PoolHomeShellProps = PoolHomeTabProps

/** Pool Home main content — dashboard sections inside the shared pool shell. */
export function PoolHomeShell({ className, ...props }: PoolHomeShellProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0',
        POOL_DESKTOP_CONTENT_RAIL_CLASS,
        'py-6',
        className,
      )}
    >
      <PoolHomeTab {...props} />
    </div>
  )
}
