import { fetchPoolOgData } from '@/src/lib/og/pool-og-data'
import { POOL_OG_SIZE, renderPoolOgImage } from '@/src/lib/og/render-pool-og'
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'Join this pool on PoolCup'
export const size = POOL_OG_SIZE
export const contentType = 'image/png'

type Props = { params: Promise<{ invite_code: string }> }

export default async function Image({ params }: Props) {
  const { invite_code: inviteCode } = await params
  const pool = await fetchPoolOgData(inviteCode)

  if (!pool) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#080b0f',
            color: '#f0f4f8',
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          PoolCup
        </div>
      ),
      { ...POOL_OG_SIZE },
    )
  }

  return renderPoolOgImage(pool)
}
