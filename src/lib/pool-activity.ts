import { supabase } from '@/src/lib/supabase'

export type PoolActivityType = 'predictions_created' | 'predictions_updated'

export type PoolActivitySubjectType = 'group' | 'third_place' | 'match'

export type PoolActivityInsert = {
  type: PoolActivityType
  subject_type: PoolActivitySubjectType
  group_name?: string | null
  match_id?: string | null
}

export function recordPoolActivityEntries(
  poolId: string,
  memberId: string,
  entries: PoolActivityInsert[],
): void {
  if (entries.length === 0) return

  void (async () => {
    try {
      const rows = entries.map((entry) => ({
        pool_id: poolId,
        member_id: memberId,
        type: entry.type,
        subject_type: entry.subject_type,
        group_name: entry.group_name ?? null,
        match_id: entry.match_id ?? null,
      }))

      const { error: insertError } = await supabase
        .from('pool_activity')
        .insert(rows)

      if (insertError) {
        console.error('recordPoolActivityEntries insert failed:', insertError.message)
      }
    } catch (err) {
      console.error('recordPoolActivityEntries failed:', err)
    }
  })()
}

export function recordWinnerOnlySaveActivity(
  poolId: string,
  memberId: string,
  opts: {
    changedGroups: Array<{ groupName: string; baselineWasEmpty: boolean }>
    thirdPlace?: { baselineWasEmpty: boolean }
  },
): void {
  const entries: PoolActivityInsert[] = opts.changedGroups.map((group) => ({
    type: group.baselineWasEmpty ? 'predictions_created' : 'predictions_updated',
    subject_type: 'group',
    group_name: group.groupName,
    match_id: null,
  }))

  if (opts.thirdPlace) {
    entries.push({
      type: opts.thirdPlace.baselineWasEmpty
        ? 'predictions_created'
        : 'predictions_updated',
      subject_type: 'third_place',
      group_name: null,
      match_id: null,
    })
  }

  recordPoolActivityEntries(poolId, memberId, entries)
}

export function recordClassicMatchSaveActivity(
  poolId: string,
  memberId: string,
  changedMatches: Array<{ matchId: string; hadPriorPrediction: boolean }>,
): void {
  const entries: PoolActivityInsert[] = changedMatches.map((match) => ({
    type: match.hadPriorPrediction ? 'predictions_updated' : 'predictions_created',
    subject_type: 'match',
    group_name: null,
    match_id: match.matchId,
  }))

  recordPoolActivityEntries(poolId, memberId, entries)
}
