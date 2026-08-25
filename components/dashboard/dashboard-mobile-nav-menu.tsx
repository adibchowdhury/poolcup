'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, History, BarChart3, Mail, Menu, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSignOut } from '@/components/dashboard-sign-out'
import { SupportUsButton } from '@/components/support-us-button'
import { cn } from '@/lib/utils'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'

/** Above sticky header / banners / bottom nav (z-50); below toasts (z-100) and modals. */
const MOBILE_MENU_Z_INDEX = 60

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
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    right: number
  } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
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

  const menuPanel =
    open && menuPosition && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        style={{
          top: menuPosition.top,
          right: menuPosition.right,
          zIndex: MOBILE_MENU_Z_INDEX,
        }}
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
            asChild
            variant="ghost"
            role="menuitem"
            className="w-full justify-start gap-2 text-foreground hover:bg-muted"
          >
            <Link href="/history" onClick={closeMenu}>
              <History className="h-4 w-4 shrink-0" aria-hidden />
              Prediction history
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            role="menuitem"
            className="w-full justify-start gap-2 text-foreground hover:bg-muted"
          >
            <Link href="/analytics" onClick={closeMenu}>
              <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
              Analytics
            </Link>
          </Button>
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
            <Link href={DASHBOARD_TAB_HREFS['how-it-works']} onClick={closeMenu}>
              <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
              Help
            </Link>
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
    ) : null

  return (
    <>
      <div ref={triggerRef} className={cn('relative shrink-0', className)}>
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
      </div>
      {menuPanel && mounted ? createPortal(menuPanel, document.body) : null}
    </>
  )
}
