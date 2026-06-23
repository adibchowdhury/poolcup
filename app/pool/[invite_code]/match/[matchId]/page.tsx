import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ invite_code: string; matchId: string }>
}

export default async function PoolMatchRedirectPage({ params }: PageProps) {
  const { matchId } = await params
  redirect(`/match/${matchId}`)
}
