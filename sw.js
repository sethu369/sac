const CACHE = 'sac-v6';
const SHELL = ['./', './index.html', './styles.css', './script.js', './saclogo.png', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the whole app shell. SAC has no external/network dependency of any kind
// (no holiday API, no Google Calendar) — everything here is local-only by design.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Best-effort background reminder. Periodic Background Sync has very limited browser
// support and this worker cannot read the page's localStorage, so it can only show a
// generic nudge, never a per-day-aware one. Most browsers will never fire this event —
// the in-page timer in script.js is the primary reminder mechanism whenever SAC is open.
self.addEventListener('periodicsync', e => {
  if (e.tag === 'attendance-reminder') {
    e.waitUntil(
      self.registration.showNotification("Don't forget today's attendance", {
        body: 'Open SAC to check and mark your attendance for today.',
        tag: 'sac-reminder'
      })
    );
  }
});
