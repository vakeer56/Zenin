/**
 * Zenin PWA Service Worker
 * Handles Web Push notifications and notification click deep-linking.
 *
 * iOS 16.4+ requirement: the SW MUST call showNotification() inside
 * the push event handler (even if the app is open).
 */

/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'zenin-sw-v1';

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Claim all open clients so this SW controls them immediately
  event.waitUntil(self.clients.claim());
});

// ─── Fetch (passthrough) ──────────────────────────────────────────────────────
// Minimal fetch handler — pass everything through to the network.
// Expand this in the future for offline caching if needed.
self.addEventListener('fetch', (_event) => {
  // passthrough — no caching strategy yet
});

// ─── Push ─────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Zenin',
      body: event.data.text(),
      url: '/timer',
    };
  }

  const title = payload.title ?? 'Zenin';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icon-192.png',
    badge: payload.badge ?? '/icon-192.png',
    tag: payload.tag ?? 'zenin-notification',
    // Store the deep-link URL in data so notificationclick can use it
    data: { url: payload.url ?? '/timer' },
    // Vibration pattern: short-long-short
    vibrate: [100, 50, 100],
    // Keep notification visible until user interacts (Android; iOS ignores this)
    requireInteraction: false,
    // Reuse the same notification slot if one is already visible
    renotify: true,
  };

  // iOS 16.4+ REQUIRES event.waitUntil wrapping showNotification
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/timer';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
