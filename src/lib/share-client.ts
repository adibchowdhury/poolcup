'use client'

import { capturePostHog } from '@/src/lib/posthog-client'

export type ShareChannel = 'native' | 'clipboard' | 'download'

/**
 * Mint a signed prediction/leaderboard share image URL for the current user.
 * Required so OG crawlers can fetch private cards without a session.
 */
export async function mintSignedShareImageUrl(params: {
  type: 'prediction' | 'leaderboard'
  poolId: string
  matchId?: string
}): Promise<string> {
  const res = await fetch('/api/share/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error || 'Could not mint share image URL')
  }
  const data = (await res.json()) as { imageUrl?: string }
  if (!data.imageUrl) throw new Error('Could not mint share image URL')
  return data.imageUrl
}

export async function shareOrCopy(params: {
  title: string
  text?: string
  url: string
  /** Optional image URL to attach when native share supports files. */
  imageUrl?: string | null
  type: string
}): Promise<ShareChannel> {
  const { title, text, url, imageUrl, type } = params

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const data: ShareData = { title, text, url }
      if (imageUrl && typeof File !== 'undefined') {
        try {
          const res = await fetch(imageUrl)
          if (res.ok) {
            const blob = await res.blob()
            const file = new File([blob], 'poolcup-share.png', {
              type: blob.type || 'image/png',
            })
            if (
              !navigator.canShare ||
              navigator.canShare({ files: [file] })
            ) {
              data.files = [file]
            }
          }
        } catch {
          /* fall through without file */
        }
      }
      await navigator.share(data)
      capturePostHog('share_initiated', { type, channel: 'native' })
      return 'native'
    } catch (err) {
      // User abort — treat as cancelled, try clipboard below only if not abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
    }
  }

  await navigator.clipboard.writeText(url)
  capturePostHog('share_initiated', { type, channel: 'clipboard' })
  return 'clipboard'
}

export async function downloadShareImage(
  imageUrl: string,
  filename: string,
  type: string,
): Promise<void> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error('Could not generate share image')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
  capturePostHog('share_initiated', { type, channel: 'download' })
}
