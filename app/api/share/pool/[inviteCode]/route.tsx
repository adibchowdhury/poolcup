import { NextResponse } from 'next/server'
import { fetchPoolOgData } from '@/src/lib/og/pool-og-data'
import { renderShareCard } from '@/src/lib/og/share-card'
import { DEFAULT_POOL_THEME_COLOR } from '@/src/lib/pool-theme'
import { siteUrl } from '@/src/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ inviteCode: string }> }

export async function GET(_request: Request, context: Ctx) {
  const { inviteCode } = await context.params
  const pool = await fetchPoolOgData(inviteCode)
  if (!pool) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const accent = pool.themeColor ?? DEFAULT_POOL_THEME_COLOR
  const joinUrl = `${siteUrl}/join/${encodeURIComponent(pool.inviteCode)}`
  const image = renderShareCard({
    eyebrow: 'Pool invite',
    title: pool.name,
    subtitle: [
      pool.eventName,
      pool.memberCount === 1 ? '1 member' : `${pool.memberCount} members`,
      `Code ${pool.inviteCode}`,
    ]
      .filter(Boolean)
      .join(' · '),
    footerUrl: joinUrl,
    accent,
    emblemUrl: pool.emblemUrl,
    children: (
      <div
        style={{
          marginTop: 28,
          display: 'flex',
          padding: '16px 28px',
          borderRadius: 999,
          background: accent,
          color: '#080b0f',
          fontSize: 26,
          fontWeight: 800,
          width: 'fit-content',
        }}
      >
        Join my pool on PoolCup
      </div>
    ),
  })

  return image
}
