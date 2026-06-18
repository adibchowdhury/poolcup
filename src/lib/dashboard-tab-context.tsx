'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DashboardBottomNavId } from '@/src/lib/mobile-bottom-nav-routes'

type DashboardNavHandler = (navId: DashboardBottomNavId) => void

type DashboardTabContextValue = {
  activeNavId: DashboardBottomNavId | null
  setActiveNavId: (navId: DashboardBottomNavId | null) => void
  registerDashboardNavHandler: (handler: DashboardNavHandler | null) => void
  switchDashboardTab: (navId: DashboardBottomNavId) => void
}

const DashboardTabContext = createContext<DashboardTabContextValue | null>(null)

export function DashboardTabProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<DashboardNavHandler | null>(null)
  const [activeNavId, setActiveNavId] = useState<DashboardBottomNavId | null>(
    null,
  )

  const registerDashboardNavHandler = useCallback(
    (handler: DashboardNavHandler | null) => {
      handlerRef.current = handler
    },
    [],
  )

  const switchDashboardTab = useCallback((navId: DashboardBottomNavId) => {
    setActiveNavId(navId)
    handlerRef.current?.(navId)
  }, [])

  const value = useMemo(
    () => ({
      activeNavId,
      setActiveNavId,
      registerDashboardNavHandler,
      switchDashboardTab,
    }),
    [activeNavId, registerDashboardNavHandler, switchDashboardTab],
  )

  return (
    <DashboardTabContext.Provider value={value}>
      {children}
    </DashboardTabContext.Provider>
  )
}

export function useDashboardTab() {
  const context = useContext(DashboardTabContext)
  if (!context) {
    throw new Error('useDashboardTab must be used within DashboardTabProvider')
  }
  return context
}
