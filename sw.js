
const CACHE = 'sac-v6';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './saclogo.png',
  './manifest.json'
];

/*
 * Install the application shell for offline use.
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/*
 * Activate the new service worker and remove old caches.
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
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

/*
 * Serve cached resources when available.
 * If no cached resource exists, try the network.
 */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Do not intercept cross-origin requests.
  if (new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              const responseToCache = response.clone();

              event.waitUntil(
                caches.open(CACHE)
                  .then(cache =>
                    cache.put(event.request, responseToCache)
                  )
              );
            }

            return response;
          });
      })
      .catch(() =>
        caches.match('./index.html')
      )
  );
});

/*
 * Handle notification clicks.
 * Focus an existing SAC window or open SAC if necessary.
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(async clients => {
        for (const client of clients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow('./');
        }

        return undefined;
      })
  );
});
