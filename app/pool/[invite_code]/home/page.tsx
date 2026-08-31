import { PoolPageClient } from '../pool-page-client'

export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
}

/** Desktop hard-refresh at /pool/{invite}/home — same client as main pool page (full data). */
export default async function PoolHomeRoutePage({ params }: PageProps) {
  await params
  return <PoolPageClient />
}
