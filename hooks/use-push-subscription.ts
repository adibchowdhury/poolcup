'use client'

import { useCallback, useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from '@/src/lib/push/vapid'
import { capturePostHog } from '@/src/lib/posthog-client'

export type PushSupportState =
  | 'unsupported'
  | 'ios_needs_install'
  | 'ready'
  | 'loading'
  | 'error'

export type PushHookState = {
  support: PushSupportState
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  loading: boolean
  error: string | null
  isIos: boolean
  isStandalone: boolean
  refresh: () => Promise<void>
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  sendTest: () => Promise<boolean>
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSDevice = /iPad|iPhone|iPod/.test(ua)
  const iPadOs =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOs
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )
  return media || iosStandalone
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (fromEnv) return fromEnv
  try {
    const res = await fetch('/api/push/vapid-public', { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { publicKey?: string }
    return body.publicKey?.trim() || null
  } catch {
    return null
  }
}

async function ensureServiceWorker(
  vapidKey: string | null,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  })
  await navigator.serviceWorker.ready

  const worker = registration.active ?? navigator.serviceWorker.controller
  if (worker && vapidKey) {
    worker.postMessage({ type: 'poolcup_set_vapid', key: vapidKey })
  }

  return registration
}

export function usePushSubscription(): PushHookState {
  const [support, setSupport] = useState<PushSupportState>('loading')
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [vapidKey, setVapidKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ios = detectIos()
      const standalone = detectStandalone()
      setIsIos(ios)
      setIsStandalone(standalone)

      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setSupport('unsupported')
        setPermission('unsupported')
        setSubscribed(false)
        setLoading(false)
        return
      }

      if (ios && !standalone) {
        setSupport('ios_needs_install')
        setPermission(Notification.permission)
        setSubscribed(false)
        setLoading(false)
        return
      }

      const key = await fetchVapidPublicKey()
      setVapidKey(key)
      if (!key) {
        setSupport('error')
        setError('Push is not configured on this environment.')
        setLoading(false)
        return
      }

      const registration = await ensureServiceWorker(key)
      if (!registration) {
        setSupport('unsupported')
        setLoading(false)
        return
      }

      setSupport('ready')
      setPermission(Notification.permission)
      const existing = await registration.pushManager.getSubscription()
      setSubscribed(Boolean(existing))
    } catch (err) {
      setSupport('error')
      setError(err instanceof Error ? err.message : 'Failed to check push')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if ((data as { type?: string }).type === 'push_notification_clicked') {
        capturePostHog('push_notification_clicked', {
          category: (data as { category?: string | null }).category ?? null,
        })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const subscribe = useCallback(async () => {
    setError(null)
    try {
      if (detectIos() && !detectStandalone()) {
        setSupport('ios_needs_install')
        return false
      }

      const key = vapidKey ?? (await fetchVapidPublicKey())
      if (!key) {
        setError('Push is not configured on this environment.')
        return false
      }
      setVapidKey(key)

      capturePostHog('push_permission_requested', {})
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== 'granted') {
        capturePostHog('push_permission_denied', {
          permission: permissionResult,
        })
        setError('Permission was not granted.')
        return false
      }
      capturePostHog('push_permission_granted', {})

      const registration = await ensureServiceWorker(key)
      if (!registration) {
        setError('Service worker unavailable.')
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? 'Could not save subscription')
        return false
      }

      setSubscribed(true)
      setSupport('ready')
      capturePostHog('push_subscribed', {})
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscribe failed')
      return false
    }
  }, [vapidKey])

  const unsubscribe = useCallback(async () => {
    setError(null)
    try {
      const registration = await ensureServiceWorker(vapidKey)
      if (!registration) return false
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setSubscribed(false)
        return true
      }

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
      setSubscribed(false)
      capturePostHog('push_unsubscribed', {})
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsubscribe failed')
      return false
    }
  }, [vapidKey])

  const sendTest = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = (await res.json().catch(() => null)) as {
        error?: string
        message?: string
      } | null
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'Test push failed')
        return false
      }
      capturePostHog('push_test_sent', {})
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test push failed')
      return false
    }
  }, [])

  return {
    support,
    permission,
    subscribed,
    loading,
    error,
    isIos,
    isStandalone,
    refresh,
    subscribe,
    unsubscribe,
    sendTest,
  }
}
