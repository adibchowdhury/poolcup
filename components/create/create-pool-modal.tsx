'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  Suspense,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { CreatePoolWizard } from '@/components/create/create-pool-wizard'
import {
  consumeCreatePoolModalHandoff,
  type CreatePoolModalHandoff,
} from '@/src/lib/create-pool-modal-handoff'
import { cn } from '@/lib/utils'

type CreatePoolModalContextValue = {
  open: boolean
  openCreatePoolModal: (handoff?: CreatePoolModalHandoff | null) => void
  closeCreatePoolModal: () => void
}

const CreatePoolModalContext =
  createContext<CreatePoolModalContextValue | null>(null)

export function useCreatePoolModal(): CreatePoolModalContextValue {
  const ctx = useContext(CreatePoolModalContext)
  if (!ctx) {
    throw new Error(
      'useCreatePoolModal must be used within CreatePoolModalProvider',
    )
  }
  return ctx
}

/** Optional — entry points outside the hub can fall back to navigation. */
export function useCreatePoolModalOptional(): CreatePoolModalContextValue | null {
  return useContext(CreatePoolModalContext)
}

function CreatePoolModalLayer({
  wizardKey,
  handoff,
  onClose,
}: {
  wizardKey: number
  handoff: CreatePoolModalHandoff | null
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[200] hidden lg:flex lg:items-center lg:justify-center lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Create a pool"
    >
      {/* Full-viewport dim — covers sidebar + top bar; clicks ignored. */}
      <div className="absolute inset-0 bg-black/90" aria-hidden />
      <div className="relative z-10 w-full max-w-3xl">
        <Suspense
          fallback={
            <div
              className={cn(
                'flex w-full items-center justify-center rounded-2xl border-2 border-[#292929] bg-[#111111] text-sm text-[#5a7080]',
                'h-[min(760px,90vh,calc(100dvh-3rem))]',
              )}
            >
              Loading…
            </div>
          }
        >
          <CreatePoolWizard
            key={wizardKey}
            variant="modal"
            checkoutHandoff={handoff}
            onRequestClose={onClose}
          />
        </Suspense>
      </div>
    </div>
  )
}

export function CreatePoolModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [handoff, setHandoff] = useState<CreatePoolModalHandoff | null>(null)
  const [wizardKey, setWizardKey] = useState(0)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const openCreatePoolModal = useCallback(
    (next?: CreatePoolModalHandoff | null) => {
      setHandoff(next ?? null)
      setWizardKey((k) => k + 1)
      setOpen(true)
    },
    [],
  )

  const closeCreatePoolModal = useCallback(() => {
    setOpen(false)
    setHandoff(null)
  }, [])

  // Pathname-driven: /create desktop bounce replaces to dashboard without remounting
  // this provider — re-check handoff on every hub navigation.
  useEffect(() => {
    if (pathname === '/create') return
    const pending = consumeCreatePoolModalHandoff()
    if (!pending) return
    openCreatePoolModal(pending)
  }, [pathname, openCreatePoolModal])

  const value = useMemo(
    () => ({ open, openCreatePoolModal, closeCreatePoolModal }),
    [open, openCreatePoolModal, closeCreatePoolModal],
  )

  const overlay =
    open && portalReady
      ? createPortal(
          <CreatePoolModalLayer
            wizardKey={wizardKey}
            handoff={handoff}
            onClose={closeCreatePoolModal}
          />,
          document.body,
        )
      : null

  return (
    <CreatePoolModalContext.Provider value={value}>
      {children}
      {overlay}
    </CreatePoolModalContext.Provider>
  )
}
