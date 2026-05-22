import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DashboardSignOut } from '@/components/dashboard-sign-out'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type Pool = {
  id: string
  name: string
  invite_code: string
  payment_status: string
}

function formatPaymentStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>
}) {
  const { passwordReset } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: pools, error } = await supabase
    .from('pools')
    .select('id, name, invite_code, payment_status')
    .eq('creator_id', user.id)

  if (error) {
    console.error('Failed to fetch pools:', error.message)
  }

  const userPools = (pools ?? []) as Pool[]

  return (
    <main className="min-h-screen bg-[#080b0f] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-5xl tracking-wide text-[#f0f4f8]">
            My Pools
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <DashboardSignOut email={user.email ?? ''} />
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 transition-colors"
            >
              Create a Pool
            </Link>
          </div>
        </header>

        {passwordReset === 'success' && (
          <div className="mt-6 rounded-lg border border-[#00e676]/30 bg-[#00e676]/10 px-4 py-3 text-sm text-[#00e676]">
            Your password has been updated successfully.
          </div>
        )}

        <section className="mt-10">
          {userPools.length === 0 ? (
            <div className="rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-10 text-center">
              <p className="text-[#5a7080]">
                No pools yet — create your first one
              </p>
              <Link
                href="/create"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 transition-colors"
              >
                Create a Pool
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {userPools.map((pool) => (
                <li key={pool.id}>
                  <Link
                    href={`/pool/${pool.invite_code}`}
                    className="block rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-6 transition-colors hover:border-[#00e676]/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#f0f4f8]">
                          {pool.name}
                        </h2>
                        <p className="mt-1 text-sm text-[#5a7080]">
                          Invite code:{' '}
                          <span className="font-mono text-[#f0f4f8]">
                            {pool.invite_code}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                          pool.payment_status === 'active' ||
                            pool.payment_status === 'paid'
                            ? 'bg-[#00e676]/15 text-[#00e676]'
                            : 'bg-[#1a2535] text-[#5a7080]'
                        }`}
                      >
                        {formatPaymentStatus(pool.payment_status)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
