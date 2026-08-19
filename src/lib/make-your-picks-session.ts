/** Session-only picks marked from the match hub (Make Your Picks queue UI). */
const STORAGE_KEY = 'poolcup:make-your-picks-picked'

export const MAKE_YOUR_PICKS_PICKED_EVENT = 'poolcup:make-your-picks-picked'

function readIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

/** Call after a successful classic prediction save on the match hub. */
export function markMakeYourPicksMatchPicked(matchId: string): void {
  const ids = readIds()
  if (ids.has(matchId)) return
  ids.add(matchId)
  writeIds(ids)
  window.dispatchEvent(new CustomEvent(MAKE_YOUR_PICKS_PICKED_EVENT, { detail: matchId }))
}

export function readMakeYourPicksPickedMatchIds(): Set<string> {
  return readIds()
}

/** Sync picked ids when returning from match hub or another tab. */
export function subscribeMakeYourPicksPicked(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange()
  }
  const onCustom = () => onChange()
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(MAKE_YOUR_PICKS_PICKED_EVENT, onCustom)
  window.addEventListener('focus', onCustom)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onCustom)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(MAKE_YOUR_PICKS_PICKED_EVENT, onCustom)
    window.removeEventListener('focus', onCustom)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onCustom)
  }
}
