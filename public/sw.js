/* Bislig Hub service worker — installability only.
 *
 * This worker deliberately does NOT cache app or API responses:
 * - Supabase realtime/auth/dispatch/delivery must always hit the network.
 * - The app shell is versioned by Vite hashed filenames; caching it here
 *   would risk stale releases.
 * Its sole jobs: make the app installable (a controlled SW is required)
 * and take over cleanly on update.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only: never serve stale content, never cache Supabase traffic.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
