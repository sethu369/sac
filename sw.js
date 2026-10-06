const CACHE = 'sac-v4';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './saclogo.png',
  './manifest.json'
];

/* ---------- Install ---------- */

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate ---------- */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch ---------- */

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE).then(cache => {
              cache.put(event.request, response.clone());
            });
          }

          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

/* ---------- Background reminder ---------- */

/*
 * Periodic Background Sync is browser-controlled.
 * It is NOT an exact-time scheduler.
 *
 * If the browser allows this event to run, show a generic
 * attendance reminder. The service worker cannot read SAC's
 * localStorage, so it cannot determine whether today is a
 * Sunday, holiday, Attended, or Absent.
 */
self.addEventListener('periodicsync', event => {
  if (event.tag !== 'attendance-reminder') return;

  event.waitUntil(
    self.registration.showNotification(
      "Don't forget today's attendance",
      {
        body: 'Open SAC to check and mark your attendance.',
        tag: 'sac-background-reminder',
        renotify: false
      }
    )
  );
});

/* ---------- Notification click ---------- */

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(clients => {
        for (const client of clients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow('./');
        }
      })
  );
});