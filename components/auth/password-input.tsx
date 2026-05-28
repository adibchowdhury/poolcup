'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export const authInputClassName =
  'w-full rounded-lg bg-[#080b0f] border border-[#1e2d3d] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  wrapperClassName?: string
}

export function PasswordInput({
  className,
  wrapperClassName,
  id: idProp,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const id = idProp ?? generatedId

  return (
    <div className={cn('relative', wrapperClassName)}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn(authInputClassName, 'pr-11', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={0}
        disabled={disabled}
        onClick={() => setVisible((show) => !show)}
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#5a7080] transition-colors',
          'hover:text-[#f0f4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  )
}
