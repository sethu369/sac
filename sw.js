const CACHE = 'sac-v2';
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

// Cache-first for the app shell, network-first fallback to cache for everything else.
// The public-holiday API call (date.nager.at) is intentionally left uncached here so
// "Import holidays" always hits the network and fails clearly when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'date.nager.at') return; // let the page's own online check handle this
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
// support (mainly installed PWAs on Chromium/Android) and cannot read this app's
// localStorage from here, so it can only show a generic nudge, not a per-day-aware one.
// Most browsers will never fire this event — the in-page timer in script.js is the
// primary reminder mechanism whenever the app itself is open.
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
