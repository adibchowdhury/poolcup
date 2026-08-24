import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    }),
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const RECENT_DAYS = 14
const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()

async function main() {
  const [mostPred, climb, events, recentPools, recentJoins, recentPreds, wcPredCount, mlsPredCount] =
    await Promise.all([
      supabase.rpc('get_most_predicted_matches', { p_match_ids: null, p_limit: 5 }),
      supabase.rpc('get_biggest_leaderboard_movements', { p_limit: 3 }),
      supabase.from('sporting_events').select('id, name, slug, status').order('name'),
      supabase
        .from('pools')
        .select('id, name, created_at, event_id, sporting_events(name, status)')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('pool_members')
        .select('id, joined_at, display_name, pool_id, pools(name, event_id, sporting_events(name, status))')
        .gte('joined_at', cutoff)
        .order('joined_at', { ascending: false })
        .limit(10),
      supabase
        .from('predictions')
        .select('id, submitted_at, pool_id, member_id, pools(name, event_id, sporting_events(name, status))')
        .gte('submitted_at', cutoff)
        .order('submitted_at', { ascending: false })
        .limit(5),
      supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .gte('submitted_at', cutoff),
      supabase.rpc('get_most_predicted_matches', { p_match_ids: null, p_limit: 1 }),
    ])

  // Top predicted match details
  let topMatch = null
  const topId = mostPred.data?.[0]?.match_id
  if (topId) {
    const { data } = await supabase
      .from('matches')
      .select('id, team1_name, team2_name, kickoff_at, event_id, sporting_events(name, status)')
      .eq('id', topId)
      .maybeSingle()
    topMatch = { ...mostPred.data[0], match: data }
  }

  // Aggregated picks today by user+pool
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: bulkPicks } = await supabase
    .from('predictions')
    .select('member_id, pool_id, submitted_at, pool_members(display_name), pools(name, sporting_events(status))')
    .gte('submitted_at', todayStart.toISOString())
    .limit(5000)

  const agg = new Map()
  for (const p of bulkPicks ?? []) {
    const hour = p.submitted_at?.slice(0, 13) ?? 'unknown'
    const key = `${p.member_id}:${p.pool_id}:${hour}`
    agg.set(key, (agg.get(key) ?? 0) + 1)
  }
  const topBulk = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  // pool_activity row count recent
  const { count: activityCount } = await supabase
    .from('pool_activity')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', cutoff)

  console.log(JSON.stringify({
    cutoff,
    currentSources: {
      get_most_predicted_matches: { error: mostPred.error?.message, top5: mostPred.data, topMatchDetail: topMatch },
      get_biggest_leaderboard_movements: { error: climb.error?.message, data: climb.data },
    },
    sporting_events: events.data,
    recent14d: {
      pools: { error: recentPools.error?.message, count: recentPools.data?.length, sample: recentPools.data },
      joins: { error: recentJoins.error?.message, count: recentJoins.data?.length, sample: recentJoins.data },
      predictionsSample: { error: recentPreds.error?.message, sample: recentPreds.data },
      predictionsTotalSinceCutoff: wcPredCount.count,
      pool_activity_rows: activityCount,
      topBulkPickBucketsToday: topBulk,
    },
  }, null, 2))
}

main().catch(console.error)
