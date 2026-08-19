'use client'

import { createContext, useContext, type ReactNode } from 'react'

/** True when page content is already wrapped by the hub layout shell. */
export const HubLayoutContext = createContext(false)

export function HubLayoutMarker({ children }: { children: ReactNode }) {
  return (
    <HubLayoutContext.Provider value={true}>{children}</HubLayoutContext.Provider>
  )
}

export function useHubLayoutNested() {
  return useContext(HubLayoutContext)
}
