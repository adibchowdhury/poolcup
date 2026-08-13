import type { ReactNode } from 'react'
import { ImageResponse } from 'next/og'
import { DEFAULT_POOL_THEME_COLOR } from '@/src/lib/pool-theme'

export const SHARE_CARD_SIZE = { width: 1080, height: 1350 }

type ShareCardChromeProps = {
  eyebrow: string
  title: string
  subtitle?: string | null
  footerUrl: string
  children?: ReactNode
  /** Pool accent; defaults to PoolCup green. */
  accent?: string
  /** Optional pool emblem shown next to the PoolCup mark. */
  emblemUrl?: string | null
}

/** Shared branded layout for downloadable / shareable cards. */
export function ShareCardChrome({
  eyebrow,
  title,
  subtitle,
  footerUrl,
  children,
  accent = DEFAULT_POOL_THEME_COLOR,
  emblemUrl,
}: ShareCardChromeProps) {
  const trimmedEmblem =
    typeof emblemUrl === 'string' && /^https?:\/\//i.test(emblemUrl.trim())
      ? emblemUrl.trim()
      : null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        background:
          'linear-gradient(160deg, #080b0f 0%, #0f1a24 50%, #102018 100%)',
        color: '#f0f4f8',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: accent,
            color: '#080b0f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          P
        </div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>PoolCup</div>
        {trimmedEmblem ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 6 }}>
            <div
              style={{
                width: 1,
                height: 32,
                background: '#1e2d3d',
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trimmedEmblem}
              width={44}
              height={44}
              alt=""
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            />
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: accent,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 28, color: '#9fb2c3' }}>{subtitle}</div>
        ) : null}
        {children}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #1e2d3d',
          paddingTop: 28,
        }}
      >
        <div style={{ fontSize: 22, color: '#5a7080' }}>getpoolcup.com</div>
        <div style={{ fontSize: 20, color: '#9fb2c3', maxWidth: 520 }}>
          {footerUrl}
        </div>
      </div>
    </div>
  )
}

export function renderShareCard(
  props: ShareCardChromeProps,
): ImageResponse {
  return new ImageResponse(<ShareCardChrome {...props} />, {
    ...SHARE_CARD_SIZE,
  })
}

/** Safe OG/share image when token is missing/invalid or data must not be shown. */
export function renderShareFallbackCard(
  title = 'Share a moment from PoolCup',
): ImageResponse {
  return renderShareCard({
    eyebrow: 'PoolCup',
    title,
    subtitle: 'Predict. Compete. Celebrate.',
    footerUrl: 'getpoolcup.com',
  })
}
