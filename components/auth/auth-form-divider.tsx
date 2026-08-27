import { cn } from '@/lib/utils'

type AuthFormDividerProps = {
  className?: string
}

export function AuthFormDivider({ className }: AuthFormDividerProps) {
  return (
    <div className={cn('relative', className ?? 'my-6')}>
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-[#1e2d3d]" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-[#111a27] px-3 text-[#5a7080]">or</span>
      </div>
    </div>
  )
}
