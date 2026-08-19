'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type HubChromeProfileState = {
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
}

type HubChromeProfileContextValue = HubChromeProfileState & {
  setProfile: (patch: Partial<HubChromeProfileState>) => void
}

const HubChromeProfileContext =
  createContext<HubChromeProfileContextValue | null>(null)

export function HubChromeProfileProvider({
  initial,
  children,
}: {
  initial: HubChromeProfileState
  children: ReactNode
}) {
  const [state, setState] = useState<HubChromeProfileState>(initial)

  const setProfile = useCallback((patch: Partial<HubChromeProfileState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      if (
        next.displayName === prev.displayName &&
        next.avatar === prev.avatar &&
        next.customAvatarUrl === prev.customAvatarUrl
      ) {
        return prev
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ ...state, setProfile }),
    [state, setProfile],
  )

  return (
    <HubChromeProfileContext.Provider value={value}>
      {children}
    </HubChromeProfileContext.Provider>
  )
}

export function useHubChromeProfileOptional() {
  return useContext(HubChromeProfileContext)
}
