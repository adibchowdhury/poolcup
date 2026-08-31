'use client'

import { createContext, useContext } from 'react'

/** True when settings render in the desktop full-width workspace (not mobile tab). */
export const PoolSettingsDesktopWorkspaceContext = createContext(false)

export function usePoolSettingsDesktopWorkspace(): boolean {
  return useContext(PoolSettingsDesktopWorkspaceContext)
}
