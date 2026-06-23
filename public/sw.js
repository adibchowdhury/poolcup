// Phase 1 placeholder — no caching. Replace with push service worker in Phase 2.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
