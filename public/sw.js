// LaCuenta Porfa service worker — caches the app shell so the PWA opens fast and
// keeps working (read-only, on cached data) with no connection. This is a
// hand-rolled runtime cache, not a full offline-sync engine: writes (marking
// consumption, uploading a receipt, changing payment status) still need a
// live connection to Supabase, which is never intercepted here since it's a
// different origin.
//
// Navigation requests (the HTML shell) are network-first: every new deploy
// ships a new hashed JS bundle referenced from index.html, and a stale
// cached index.html pointing at a bundle hash that no longer exists on the
// server is exactly what causes an intermittent blank screen after an
// update. Only content-hashed static assets are safe to serve cache-first.
const CACHE_NAME = 'lacuenta-porfa-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs (the app shell: html/js/css/images/manifest).
  // Supabase calls, POSTs, etc. always go straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigation) {
    // Network-first: always try to get the current index.html (and thus the
    // current bundle reference) before ever falling back to a cached copy.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Cache-first for instant loads; falls back to network, then to the
      // cached copy again if the network fails (offline).
      return cached || network;
    })
  );
});
