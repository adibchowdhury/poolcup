import { cn } from '@/lib/utils'

type AuthFormDividerProps = {
  className?: string
  /** Background behind the “or” label — match the surrounding card surface. */
  surfaceClassName?: string
}

export function AuthFormDivider({
  className,
  surfaceClassName = 'bg-[#111a27]',
}: AuthFormDividerProps) {
  return (
    <div className={cn('relative', className ?? 'my-6')}>
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-[#1e2d3d]" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className={cn(surfaceClassName, 'px-3 text-[#5a7080]')}>or</span>
      </div>
    </div>
  )
}
