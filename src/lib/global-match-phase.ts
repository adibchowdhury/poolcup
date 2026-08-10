import { isMatchLocked } from '@/src/lib/match-lock'
import { isVoidMatchStatus } from '@/src/lib/match-void-status'

export type GlobalMatchPhase = 'upcoming' | 'live' | 'final' | 'void'

export function deriveGlobalMatchPhase(match: {
  is_final: boolean
  locked_at: string | null
  status_short?: string | null
}): GlobalMatchPhase {
  if (isVoidMatchStatus(match.status_short)) return 'void'
  if (match.is_final) return 'final'
  if (isMatchLocked(match.locked_at)) return 'live'
  return 'upcoming'
}
