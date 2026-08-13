import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PoolPrintView } from '@/components/pool/pool-print-view'
import { fetchIsPoolAdmin } from '@/src/lib/pool-admin'
import {
  fetchLeaderboardExportRows,
  fetchPredictionExportRows,
  loadPoolExportMeta,
} from '@/src/lib/pool-export'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PageProps = {
  params: Promise<{ invite_code: string }>
}

export const metadata: Metadata = {
  title: 'Printable pool export · PoolCup',
  robots: { index: false, follow: false },
}

export default async function PoolPrintPage({ params }: PageProps) {
  const { invite_code: inviteCodeRaw } = await params
  const inviteCode = inviteCodeRaw?.trim()
  if (!inviteCode) {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/pool/${encodeURIComponent(inviteCode)}/print`)}`,
    )
  }

  const admin = createAdminSupabaseClient()
  const { data: pool } = await admin
    .from('pools')
    .select('id, invite_code')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (!pool?.id) {
    return (
      <ForbiddenOrMissing
        title="Pool not found"
        message="This pool could not be found."
        href="/dashboard"
      />
    )
  }

  const isAdmin = await fetchIsPoolAdmin(admin, pool.id, user.id)
  if (!isAdmin) {
    return (
      <ForbiddenOrMissing
        title="Commissioners only"
        message="Only pool admins can open the printable export."
        href={`/pool/${encodeURIComponent(inviteCode)}`}
      />
    )
  }

  const meta = await loadPoolExportMeta(admin, pool.id)
  if (!meta) {
    return (
      <ForbiddenOrMissing
        title="Pool not found"
        message="This pool could not be found."
        href="/dashboard"
      />
    )
  }

  const [leaderboardResult, predictionsResult] = await Promise.all([
    fetchLeaderboardExportRows(admin, user.id, pool.id),
    fetchPredictionExportRows(admin, user.id, pool.id),
  ])

  if (leaderboardResult.error || predictionsResult.error) {
    console.error('print export failed', {
      leaderboard: leaderboardResult.error,
      predictions: predictionsResult.error,
    })
    return (
      <ForbiddenOrMissing
        title="Export failed"
        message="Could not load export data. Try again from pool settings."
        href={`/pool/${encodeURIComponent(inviteCode)}?tab=settings`}
      />
    )
  }

  return (
    <PoolPrintView
      meta={meta}
      leaderboard={leaderboardResult.rows}
      predictions={predictionsResult.rows}
      poolHref={`/pool/${encodeURIComponent(inviteCode)}`}
    />
  )
}

function ForbiddenOrMissing({
  title,
  message,
  href,
}: {
  title: string
  message: string
  href: string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-background px-4 text-center text-foreground">
      <h1 className="font-display text-2xl tracking-wide">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Link
        href={href}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Go back
      </Link>
    </div>
  )
}
