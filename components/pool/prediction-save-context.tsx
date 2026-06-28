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

export type PredictionSaveResult = 'ok' | 'locked' | 'error' | 'noop'

export type PredictionSaveHandle = {
  matchId: string
  isDirty: () => boolean
  isLocked: () => boolean
  save: () => Promise<PredictionSaveResult>
}

type PredictionSaveContextValue = {
  register: (handle: PredictionSaveHandle) => () => void
  bumpDirty: () => void
  getHandles: () => Map<string, PredictionSaveHandle>
  /** Bumped when any card edits or finishes a save — drives unsavedCount recomputation. */
  dirtyVersion: number
}

const PredictionSaveContext = createContext<PredictionSaveContextValue | null>(
  null,
)

export function PredictionSaveProvider({ children }: { children: ReactNode }) {
  const handlesRef = useRef(new Map<string, PredictionSaveHandle>())
  const [dirtyVersion, setDirtyVersion] = useState(0)

  const bumpDirty = useCallback(() => {
    setDirtyVersion((version) => version + 1)
  }, [])

  const register = useCallback((handle: PredictionSaveHandle) => {
    handlesRef.current.set(handle.matchId, handle)
    return () => {
      handlesRef.current.delete(handle.matchId)
    }
  }, [])

  const getHandles = useCallback(() => handlesRef.current, [])

  const value = useMemo(
    () => ({ register, bumpDirty, getHandles, dirtyVersion }),
    [register, bumpDirty, getHandles, dirtyVersion],
  )

  return (
    <PredictionSaveContext.Provider value={value}>
      {children}
    </PredictionSaveContext.Provider>
  )
}

export function usePredictionSaveContext(): PredictionSaveContextValue | null {
  return useContext(PredictionSaveContext)
}

export function usePredictionSaveCoordinator(activeMatchIds: string[]) {
  const context = useContext(PredictionSaveContext)

  const unsavedCount = useMemo(() => {
    if (!context) return 0
    void context.dirtyVersion

    let count = 0
    for (const matchId of activeMatchIds) {
      const handle = context.getHandles().get(matchId)
      if (handle && !handle.isLocked() && handle.isDirty()) {
        count += 1
      }
    }
    return count
  }, [activeMatchIds, context, context?.dirtyVersion])

  const saveAll = useCallback(async () => {
    if (!context) {
      return { ok: 0, locked: 0, error: 0 }
    }

    let ok = 0
    let locked = 0
    let error = 0

    for (const matchId of activeMatchIds) {
      const handle = context.getHandles().get(matchId)
      if (!handle || handle.isLocked() || !handle.isDirty()) continue

      const result = await handle.save()
      if (result === 'ok') ok += 1
      else if (result === 'locked') locked += 1
      else if (result === 'error') error += 1
    }

    context.bumpDirty()
    return { ok, locked, error }
  }, [activeMatchIds, context])

  return { unsavedCount, saveAll }
}
