// Temporary self-unregistering worker to retire the Phase 1 PWA service worker.
// Safe to delete this file entirely in a future release once clients have updated.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      const clients = await self.clients.matchAll()
      clients.forEach((client) => client.navigate(client.url))
    })(),
  )
})
