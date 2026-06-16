'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type MobileChatChromeContextValue = {
  mobileChatActive: boolean
  setMobileChatActive: (active: boolean) => void
}

const MobileChatChromeContext =
  createContext<MobileChatChromeContextValue | null>(null)

export function MobileChatChromeProvider({ children }: { children: ReactNode }) {
  const [mobileChatActive, setMobileChatActive] = useState(false)
  const value = useMemo(
    () => ({ mobileChatActive, setMobileChatActive }),
    [mobileChatActive],
  )

  return (
    <MobileChatChromeContext.Provider value={value}>
      {children}
    </MobileChatChromeContext.Provider>
  )
}

export function useMobileChatChrome() {
  const context = useContext(MobileChatChromeContext)
  if (!context) {
    throw new Error(
      'useMobileChatChrome must be used within MobileChatChromeProvider',
    )
  }
  return context
}
