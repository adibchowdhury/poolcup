import { ImageResponse } from 'next/og'
import type { PoolOgData } from '@/src/lib/og/pool-og-data'

export const POOL_OG_SIZE = { width: 1200, height: 630 }

export function renderPoolOgImage(pool: PoolOgData): ImageResponse {
  const membersLabel =
    pool.memberCount === 1
      ? '1 member'
      : `${pool.memberCount} members`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background:
            'linear-gradient(145deg, #080b0f 0%, #0f1a24 45%, #13261c 100%)',
          color: '#f0f4f8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#00e676',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#080b0f',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
            PoolCup
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 22,
              color: '#00e676',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
            Join my pool
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {pool.name}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 26, color: '#9fb2c3' }}>
            {pool.eventName ? <span>{pool.eventName}</span> : null}
            {pool.eventName ? <span>·</span> : null}
            <span>{membersLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '14px 22px',
              borderRadius: 999,
              background: '#00e676',
              color: '#080b0f',
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            Join on PoolCup
          </div>
          <div style={{ fontSize: 22, color: '#5a7080', fontFamily: 'monospace' }}>
            /join/{pool.inviteCode}
          </div>
        </div>
      </div>
    ),
    { ...POOL_OG_SIZE },
  )
}
