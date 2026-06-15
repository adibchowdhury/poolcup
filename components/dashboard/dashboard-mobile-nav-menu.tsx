'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Mail, Menu, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSignOut } from '@/components/dashboard-sign-out'
import { SupportUsButton } from '@/components/support-us-button'
import { cn } from '@/lib/utils'

type DashboardMobileNavMenuProps = {
  displayName?: string | null
  email: string
  onOpenSettings: () => void
  className?: string
}

export function DashboardMobileNavMenu({
  displayName,
  email,
  onOpenSettings,
  className,
}: DashboardMobileNavMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open])

  function closeMenu() {
    setOpen(false)
  }

  function handleOpenSettings() {
    closeMenu()
    onOpenSettings()
  }

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="flex flex-col gap-1 p-2">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName?.trim() || 'Account'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <div className="border-b border-border" role="separator" />
            <SupportUsButton
              fullWidth
              className="justify-center"
              onNavigate={closeMenu}
            />
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              className="w-full justify-start gap-2 text-foreground hover:bg-muted"
              onClick={handleOpenSettings}
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden />
              Settings
            </Button>
            <Button
              asChild
              variant="ghost"
              role="menuitem"
              className="w-full justify-start gap-2 text-foreground hover:bg-muted"
            >
              <Link href="/contact" onClick={closeMenu}>
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                Contact
              </Link>
            </Button>
            <DashboardSignOut
              displayName={displayName}
              menuItem
              onAfterClick={closeMenu}
            />
          </div>
        </div>
      )}
    </div>
  )
}
