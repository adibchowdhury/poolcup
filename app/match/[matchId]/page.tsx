import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GlobalMatchDetailPage } from '@/components/match/global-match-detail-page'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type PageProps = {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('team1_name, team2_name, kickoff_at, event_id')
    .eq('id', matchId)
    .maybeSingle()

  if (!match) {
    return {
      title: 'Match not found · PoolCup',
      description: 'This match could not be found on PoolCup.',
    }
  }

  let eventName = 'PoolCup'
  if (match.event_id) {
    const { data: event } = await supabase
      .from('sporting_events')
      .select('name')
      .eq('id', match.event_id)
      .maybeSingle()
    const name = event?.name?.trim()
    if (name) eventName = name
  }

  const team1 = match.team1_name
  const team2 = match.team2_name
  const kickoffLabel = match.kickoff_at
    ? formatFeaturedKickoffLocal(match.kickoff_at)
    : null

  const title = `${team1} vs ${team2} · ${eventName} predictions on PoolCup`
  const description = kickoffLabel
    ? `See predictions for ${team1} vs ${team2} in ${eventName} (${kickoffLabel}) on PoolCup.`
    : `See predictions for ${team1} vs ${team2} in ${eventName} on PoolCup.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function GlobalMatchPage({ params }: PageProps) {
  const { matchId } = await params

  return (
    <Suspense fallback={null}>
      <GlobalMatchDetailPage matchId={matchId} />
    </Suspense>
  )
}
