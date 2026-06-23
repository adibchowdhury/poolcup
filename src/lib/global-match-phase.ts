import { isMatchLocked } from '@/src/lib/match-lock'

export type GlobalMatchPhase = 'upcoming' | 'live' | 'final'

export function deriveGlobalMatchPhase(match: {
  is_final: boolean
  locked_at: string | null
}): GlobalMatchPhase {
  if (match.is_final) return 'final'
  if (isMatchLocked(match.locked_at)) return 'live'
  return 'upcoming'
}
