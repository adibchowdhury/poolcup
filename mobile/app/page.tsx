'use client'

import { useEffect, useRef, useState } from 'react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { MobileMatchDetail } from '../components/mobile-match-detail'
import { MobilePoolsTab } from '../components/mobile-pools-tab'
import { MobilePoolDetail } from '../components/mobile-pool-detail'
import { MobileMatchesTab } from '../components/mobile-matches-tab'
import { MobileChatTab, type ChatView } from '../components/mobile-chat-tab'
import { MobileProfileTab } from '../components/mobile-profile-tab'
import {
  MOBILE_TAB_BAR_SCROLL_PAD_CLASS,
  MobileTabBar,
  type MobileTabId,
} from '../components/mobile-tab-bar'
import { supabase } from '../lib/supabase-mobile'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import type { PoolChatInboxItem } from '@/src/lib/pool-chats'

type AuthStatus = 'checking' | 'signedOut' | 'signedIn'
type PoolsView = 'list' | 'detail'

type MatchDetailState = {
  matchId: string
  originTab: MobileTabId
}

export default function MobileHomePage() {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [activeTab, setActiveTab] = useState<MobileTabId>('pools')
  const [view, setView] = useState<PoolsView>('list')
  const [selectedPool, setSelectedPool] = useState<DashboardPoolCardData | null>(
    null,
  )
  const [chatView, setChatView] = useState<ChatView>('list')
  const [selectedChatPool, setSelectedChatPool] =
    useState<PoolChatInboxItem | null>(null)
  const [matchDetail, setMatchDetail] = useState<MatchDetailState | null>(null)
  const viewRef = useRef<PoolsView>('list')
  const activeTabRef = useRef<MobileTabId>('pools')
  const chatViewRef = useRef<ChatView>('list')
  const matchDetailRef = useRef<MatchDetailState | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pools, setPools] = useState<DashboardPoolCardData[]>([])
  const [poolsLoading, setPoolsLoading] = useState(false)
  const [poolsError, setPoolsError] = useState<string | null>(null)

  viewRef.current = view
  activeTabRef.current = activeTab
  chatViewRef.current = chatView
  matchDetailRef.current = matchDetail

  useEffect(() => {
    async function configureStatusBar() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const { StatusBar, Style } = await import('@capacitor/status-bar')
        // Style.Dark = light text/icons on a dark background (enum names are inverted)
        await StatusBar.setStyle({ style: Style.Dark })
      } catch {
        // native plugin unavailable — ignore on web/static export
      }
    }

    void configureStatusBar()
  }, [])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined

    async function scheduleHideSplashScreen() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform() || cancelled) return

        const { SplashScreen } = await import('@capacitor/splash-screen')
        timeoutId = window.setTimeout(() => {
          if (!cancelled) {
            void SplashScreen.hide({ fadeOutDuration: 300 })
          }
        }, 1800)
      } catch {
        // splash plugin unavailable — ignore on web/static export
      }
    }

    void scheduleHideSplashScreen()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      if (data.session?.user) {
        setSignedInEmail(data.session.user.email ?? null)
        setStatus('signedIn')
      } else {
        setStatus('signedOut')
      }
    }

    void initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (session?.user) {
        setSignedInEmail(session.user.email ?? null)
        setStatus('signedIn')
        setError(null)
        setLoading(false)
      } else {
        setSignedInEmail(null)
        setStatus('signedOut')
        setLoading(false)
        setPools([])
        setPoolsError(null)
        setActiveTab('pools')
        setView('list')
        setSelectedPool(null)
        setChatView('list')
        setSelectedChatPool(null)
        setMatchDetail(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (status !== 'signedIn') return

    let cancelled = false

    async function loadPools() {
      setPoolsLoading(true)
      setPoolsError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userError || !user) {
        setPoolsError(userError?.message ?? 'Could not load your account')
        setPools([])
        setPoolsLoading(false)
        return
      }

      const { pools: rows, error: fetchError } = await fetchDashboardPools(
        supabase,
        user.id,
      )

      if (cancelled) return

      setPools(rows)
      setPoolsError(fetchError)
      setPoolsLoading(false)
    }

    void loadPools()

    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    if (status !== 'signedIn') return

    let removed = false
    let listener: { remove: () => Promise<void> } | null = null

    async function registerBackButton() {
      const { App } = await import('@capacitor/app')
      if (removed) return

      listener = await App.addListener('backButton', () => {
        if (matchDetailRef.current) {
          setMatchDetail(null)
          return
        }

        if (
          activeTabRef.current === 'pools' &&
          viewRef.current === 'detail'
        ) {
          setView('list')
          setSelectedPool(null)
          return
        }

        if (
          activeTabRef.current === 'chat' &&
          chatViewRef.current === 'thread'
        ) {
          setChatView('list')
          setSelectedChatPool(null)
          return
        }

        if (activeTabRef.current !== 'pools') {
          setActiveTab('pools')
          setView('list')
          setSelectedPool(null)
          setChatView('list')
          setSelectedChatPool(null)
          return
        }

        void App.exitApp()
      })
    }

    void registerBackButton()

    return () => {
      removed = true
      void listener?.remove()
    }
  }, [status])

  function handleTabChange(tab: MobileTabId) {
    setActiveTab(tab)
    setMatchDetail(null)
    if (tab !== 'pools') {
      setView('list')
      setSelectedPool(null)
    }
    if (tab !== 'chat') {
      setChatView('list')
      setSelectedChatPool(null)
    }
  }

  function openChatThread(pool: PoolChatInboxItem) {
    setSelectedChatPool(pool)
    setChatView('thread')
  }

  function closeChatThread() {
    setChatView('list')
    setSelectedChatPool(null)
  }

  function openPoolDetail(pool: DashboardPoolCardData) {
    setSelectedPool(pool)
    setView('detail')
  }

  function closePoolDetail() {
    setView('list')
    setSelectedPool(null)
  }

  function openMatchDetail(matchId: string) {
    setMatchDetail({ matchId, originTab: activeTab })
  }

  function closeMatchDetail() {
    setMatchDetail(null)
  }

  async function handleSignIn() {
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setLoading(true)
    setError(null)
    await supabase.auth.signOut()
    setLoading(false)
  }

  return (
    <div className="app-shell flex min-h-full flex-col bg-background text-foreground">
      {status === 'checking' && (
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}

      {status === 'signedOut' && (
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="text-center">
              <h1 className="font-display text-5xl tracking-wide text-foreground">
                PoolCup
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to your account
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="mobile-email"
                  className="mb-2 block text-sm font-medium text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="mobile-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                />
              </div>

              <div>
                <label
                  htmlFor="mobile-password"
                  className="mb-2 block text-sm font-medium text-muted-foreground"
                >
                  Password
                </label>
                <input
                  id="mobile-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={loading || !email.trim() || !password}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'signedIn' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={`flex min-h-0 flex-1 flex-col ${MOBILE_TAB_BAR_SCROLL_PAD_CLASS}`}
          >
            {matchDetail ? (
              <MobileMatchDetail
                matchId={matchDetail.matchId}
                onBack={closeMatchDetail}
              />
            ) : null}

            {!matchDetail && activeTab === 'pools' && view === 'detail' && selectedPool ? (
              <MobilePoolDetail pool={selectedPool} onBack={closePoolDetail} />
            ) : null}

            {!matchDetail && activeTab === 'pools' && view === 'list' ? (
              <>
                <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
                  <div>
                    <h1 className="font-display text-3xl tracking-wide text-foreground">
                      PoolCup
                    </h1>
                    {signedInEmail ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {signedInEmail}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={loading}
                    className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Signing out…' : 'Sign out'}
                  </button>
                </header>

                <main className="flex-1 overflow-y-auto px-4 py-6">
                  <MobilePoolsTab
                    pools={pools}
                    poolsLoading={poolsLoading}
                    poolsError={poolsError}
                    onOpenPool={openPoolDetail}
                    onOpenMatch={openMatchDetail}
                  />
                </main>
              </>
            ) : null}

            {!matchDetail && activeTab === 'matches' ? (
              <MobileMatchesTab onOpenMatch={openMatchDetail} />
            ) : null}

            {activeTab === 'chat' ? (
              <MobileChatTab
                view={chatView}
                selectedPool={selectedChatPool}
                onOpenThread={openChatThread}
                onCloseThread={closeChatThread}
              />
            ) : null}

            {activeTab === 'profile' ? (
              <MobileProfileTab
                onSignOut={() => void handleSignOut()}
                signOutLoading={loading}
              />
            ) : null}
          </div>

          <MobileTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      ) : null}
    </div>
  )
}
