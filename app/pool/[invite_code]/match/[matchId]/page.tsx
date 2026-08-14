import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ invite_code: string; matchId: string }>
}

/** Pool match deep link → global match page with pool context for post-lock consensus. */
export default async function PoolMatchRedirectPage({ params }: PageProps) {
  const { matchId, invite_code } = await params
  const invite = invite_code?.trim()
  if (invite) {
    redirect(`/match/${matchId}?pool=${encodeURIComponent(invite)}`)
  }
  redirect(`/match/${matchId}`)
}
