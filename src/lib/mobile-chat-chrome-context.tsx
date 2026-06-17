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
  openChatPoolId: string | null
  setOpenChatPoolId: (poolId: string | null) => void
}

const MobileChatChromeContext =
  createContext<MobileChatChromeContextValue | null>(null)

export function MobileChatChromeProvider({ children }: { children: ReactNode }) {
  const [mobileChatActive, setMobileChatActive] = useState(false)
  const [openChatPoolId, setOpenChatPoolId] = useState<string | null>(null)
  const value = useMemo(
    () => ({
      mobileChatActive,
      setMobileChatActive,
      openChatPoolId,
      setOpenChatPoolId,
    }),
    [mobileChatActive, openChatPoolId],
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
