const CACHE = 'lirr-calc-v5';
const ASSETS = ['/', '/index.html', '/lirr-data.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-192.svg', '/icons/icon-512.svg', '/icons/favicon.svg', '/privacy.html', '/terms.html', '/og-image.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
