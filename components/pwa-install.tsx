'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'

const DISMISS_STORAGE_KEY = 'pwa_install_dismissed_at'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

type InstallPlatform = 'android' | 'ios'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return false
    const dismissedAt = Number.parseInt(raw, 10)
    if (Number.isNaN(dismissedAt)) return false
    return Date.now() - dismissedAt < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInAppWebView(): boolean {
  return /(FBAN|FBAV|Instagram|Twitter|Line|WeChat|wv)/i.test(navigator.userAgent)
}

export function PwaInstall() {
  const { user, loading } = useAuth()
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<InstallPlatform | null>(null)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const bannerShownRef = useRef(false)

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    capturePostHog('pwa_install_dismissed')
    setVisible(false)
    deferredPromptRef.current = null
  }, [])

  const showBanner = useCallback((nextPlatform: InstallPlatform) => {
    setPlatform(nextPlatform)
    setVisible(true)
    if (!bannerShownRef.current) {
      bannerShownRef.current = true
      capturePostHog('pwa_install_banner_shown', { platform: nextPlatform })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('PWA service worker registration failed:', error)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (loading || !user) {
      setVisible(false)
      return
    }

    if (isStandalone() || isDismissedRecently()) {
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPromptRef.current = event as BeforeInstallPromptEvent
      showBanner('android')
    }

    const onAppInstalled = () => {
      capturePostHog('pwa_installed')
      setVisible(false)
      deferredPromptRef.current = null
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    if (
      isIosDevice() &&
      !isStandalone() &&
      !isInAppWebView() &&
      !deferredPromptRef.current
    ) {
      showBanner('ios')
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [loading, showBanner, user])

  const handleInstallClick = async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) return

    capturePostHog('pwa_install_clicked')
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice

    if (outcome === 'accepted') {
      capturePostHog('pwa_install_accepted')
    }

    deferredPromptRef.current = null
    setVisible(false)
  }

  if (loading || !user || !visible || !platform) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4',
        'sm:bottom-6',
      )}
      role="region"
      aria-label="Install PoolCup"
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl border border-border/80',
          'bg-[#111a27] p-4 shadow-lg',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#f0f4f8]">Install PoolCup</p>
          {platform === 'android' ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Add PoolCup to your home screen for quick access during the World Cup.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap the Share icon, then &quot;Add to Home Screen&quot; to install PoolCup.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {platform === 'android' ? (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="rounded-lg bg-[#00e676] px-3 py-1.5 text-xs font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90"
            >
              Install PoolCup
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-[#f0f4f8]"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
