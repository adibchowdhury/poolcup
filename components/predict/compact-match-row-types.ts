import type { ResolvedTeamFlag } from '@/src/lib/team-flags'

export interface CompactTeam {
  name: string
  flag: ResolvedTeamFlag
  dbFlag?: string | null
}
