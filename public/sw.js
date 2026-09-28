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

// Web Push receiver (Phase 1: display only — no server sending yet).
// Expected payload (all fields optional except none):
//   { title, body, icon, badge, tag, data: { url, eventId } }
// Anything malformed or empty still shows a safe generic notification
// because userVisibleOnly subscriptions require visible feedback.
self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = parsed;
      }
    } catch {
      try {
        const text = event.data.text();
        if (text) {
          payload = { body: text };
        }
      } catch {
        // Fall through to defaults below.
      }
    }
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const tag =
    typeof data.eventId === 'string' && data.eventId
      ? `bislig-hub-${data.eventId}`
      : 'bislig-hub-update';

  const title =
    typeof payload.title === 'string' && payload.title
      ? payload.title
      : 'Bislig Hub';
  const options = {
    body:
      typeof payload.body === 'string' && payload.body
        ? payload.body
        : 'You have a new update.',
    icon: typeof payload.icon === 'string' ? payload.icon : '/icons/icon-192.png',
    badge: typeof payload.badge === 'string' ? payload.badge : '/icons/icon-192.png',
    tag,
    renotify: false,
    data: {
      url: typeof data.url === 'string' ? data.url : '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a push notification focuses an open Bislig Hub tab when one
// exists, otherwise opens the payload target. Only same-origin app paths
// are ever navigated to — external URLs are dropped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let path = '/';
  const rawUrl =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/';

  try {
    // Accept absolute same-origin URLs and root-relative paths only.
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin === self.location.origin && parsed.pathname.startsWith('/')) {
      path = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    path = '/';
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          try {
            const url = new URL(client.url);
            if (url.origin !== self.location.origin) {
              continue;
            }
          } catch {
            continue;
          }
          if ('focus' in client) {
            client.navigate(path).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(path);
        }
        return undefined;
      }),
  );
});
