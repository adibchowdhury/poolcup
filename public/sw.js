/* PoolCup Web Push service worker */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'PoolCup',
    body: '',
    data: {},
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : 'PoolCup',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        data:
          parsed.data && typeof parsed.data === 'object' ? parsed.data : {},
      }
      if (parsed.href && !payload.data.href) {
        payload.data.href = parsed.href
      }
      if (parsed.category && !payload.data.category) {
        payload.data.category = parsed.category
      }
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : ''
      if (text) payload.body = text
    } catch {
      /* ignore */
    }
  }

  const href =
    typeof payload.data.href === 'string' && payload.data.href.startsWith('/')
      ? payload.data.href
      : '/dashboard'

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      data: { ...payload.data, href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href =
    event.notification.data &&
    typeof event.notification.data.href === 'string' &&
    event.notification.data.href.startsWith('/')
      ? event.notification.data.href
      : '/dashboard'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(href)
            } catch {
              /* ignore navigate errors */
            }
          }
          client.postMessage({
            type: 'push_notification_clicked',
            href,
            category: event.notification.data?.category ?? null,
          })
          return
        }
      }

      const opened = await self.clients.openWindow(href)
      if (opened) {
        opened.postMessage({
          type: 'push_notification_clicked',
          href,
          category: event.notification.data?.category ?? null,
        })
      }
    })(),
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey = self.__POOLCUP_VAPID_PUBLIC_KEY
        if (!applicationServerKey || !self.registration.pushManager) return

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
          credentials: 'same-origin',
        })
      } catch (err) {
        console.error('pushsubscriptionchange failed', err)
      }
    })(),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'poolcup_set_vapid' && typeof data.key === 'string') {
    self.__POOLCUP_VAPID_PUBLIC_KEY = data.key
  }
})
