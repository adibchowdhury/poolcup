import type { Metadata } from 'next'
import { GlobalMatchDetailPage } from '@/components/match/global-match-detail-page'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type PageProps = {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('team1_name, team2_name')
    .eq('id', matchId)
    .maybeSingle()

  if (!match) {
    return {
      title: 'Match not found · PoolCup',
      description: 'This match could not be found on PoolCup.',
    }
  }

  const title = `${match.team1_name} vs ${match.team2_name} · World Cup 2026 predictions on PoolCup`
  const description = `See how everyone predicted ${match.team1_name} vs ${match.team2_name} on PoolCup.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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

  return <GlobalMatchDetailPage matchId={matchId} />
}
